/**
 * StockPilot WMS - Analytics & Reports Domain Service.
 *
 * Implements high-performance aggregation pipelines for executive KPI summaries,
 * inventory valuation, stock turnover, shelf-life batch aging, shrinkage audits,
 * and CSV stream serialization.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { StockBalance } from '../inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { Batch } from '../inventory/batch.model.js';
import { PurchaseOrder, PO_STATUSES } from '../purchasing/purchaseOrder.model.js';
import { PutawayTask, PUTAWAY_STATUSES } from '../inbound/putawayTask.model.js';
import { SalesOrder, SO_STATUSES } from '../outbound/salesOrder.model.js';
import { Shipment, SHIPMENT_STATUSES } from '../outbound/shipment.model.js';
import { CycleCount, COUNT_STATUSES } from '../counts/cycleCount.model.js';
import { StockAdjustment, ADJUSTMENT_STATUSES } from '../adjustments/stockAdjustment.model.js';

/**
 * Aggregates high-level executive dashboard metrics and operational velocity.
 *
 * @param {string} [warehouseId] - Optional facility filter.
 * @returns {Promise<object>} Dashboard KPI summary and health alerts.
 */
export const getDashboardAnalytics = async (warehouseId) => {
  const matchWarehouse = warehouseId
    ? { warehouse: new mongoose.Types.ObjectId(warehouseId) }
    : {};

  // 1. Inventory Valuation & On-Hand Aggregation
  const valuationAgg = await StockBalance.aggregate([
    { $match: { ...matchWarehouse, onHand: { $gt: 0 } } },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDoc',
      },
    },
    { $unwind: '$productDoc' },
    {
      $group: {
        _id: null,
        totalQuantity: { $sum: '$onHand' },
        totalReserved: { $sum: '$reserved' },
        totalCostValueMinor: {
          $sum: { $multiply: ['$onHand', { $ifNull: ['$productDoc.costPriceMinor', 0] }] },
        },
        totalSaleValueMinor: {
          $sum: { $multiply: ['$onHand', { $ifNull: ['$productDoc.salePriceMinor', 0] }] },
        },
      },
    },
  ]);

  const valuationData = valuationAgg[0] || {
    totalQuantity: 0,
    totalReserved: 0,
    totalCostValueMinor: 0,
    totalSaleValueMinor: 0,
  };

  // 2. Inbound Pipeline Throughput
  const [openPOs, pendingPutaways] = await Promise.all([
    PurchaseOrder.countDocuments({
      ...matchWarehouse,
      status: { $in: [PO_STATUSES.CONFIRMED, PO_STATUSES.PARTIALLY_RECEIVED] },
    }),
    PutawayTask.countDocuments({
      ...matchWarehouse,
      status: { $in: [PUTAWAY_STATUSES.PENDING, PUTAWAY_STATUSES.IN_PROGRESS] },
    }),
  ]);

  // 3. Outbound Fulfillment Velocity
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ordersPending, ordersPicking, dispatchedToday] = await Promise.all([
    SalesOrder.countDocuments({
      ...matchWarehouse,
      status: { $in: [SO_STATUSES.DRAFT, SO_STATUSES.CONFIRMED, SO_STATUSES.ALLOCATED] },
    }),
    SalesOrder.countDocuments({
      ...matchWarehouse,
      status: SO_STATUSES.PICKING,
    }),
    Shipment.countDocuments({
      ...matchWarehouse,
      status: SHIPMENT_STATUSES.DISPATCHED,
      dispatchedAt: { $gte: startOfToday },
    }),
  ]);

  // 4. Audit & Accuracy Metrics
  const [activeCounts, pendingAdjustments, reconciledCounts] = await Promise.all([
    CycleCount.countDocuments({
      ...matchWarehouse,
      status: { $in: [COUNT_STATUSES.IN_PROGRESS, COUNT_STATUSES.COUNTED] },
    }),
    StockAdjustment.countDocuments({
      ...matchWarehouse,
      status: ADJUSTMENT_STATUSES.DRAFT,
    }),
    CycleCount.find({
      ...matchWarehouse,
      status: COUNT_STATUSES.RECONCILED,
    })
      .select('totalItems matchedItems varianceItems')
      .lean(),
  ]);

  let totalCountedItems = 0;
  let totalMatchedItems = 0;
  for (const c of reconciledCounts) {
    totalCountedItems += c.totalItems || 0;
    totalMatchedItems += c.matchedItems || 0;
  }
  const accuracyRate =
    totalCountedItems > 0
      ? Math.round((totalMatchedItems / totalCountedItems) * 100)
      : 100;

  // 5. Critical Stock Alerts (Items below reorderLevel)
  const lowStockAgg = await StockBalance.aggregate([
    { $match: { ...matchWarehouse } },
    {
      $group: {
        _id: '$product',
        totalOnHand: { $sum: '$onHand' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $match: {
        'product.isActive': true,
        'product.reorderLevel': { $gt: 0 },
        $expr: { $lte: ['$totalOnHand', '$product.reorderLevel'] },
      },
    },
    {
      $project: {
        _id: 1,
        sku: '$product.sku',
        name: '$product.name',
        reorderLevel: '$product.reorderLevel',
        reorderQuantity: '$product.reorderQuantity',
        totalOnHand: 1,
      },
    },
    { $sort: { totalOnHand: 1 } },
    { $limit: 6 },
  ]);

  // 6. Expiring Batches (< 30 days)
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

  const expiringBatches = await Batch.find({
    status: 'ACTIVE',
    expiresOn: { $ne: null, $gte: new Date(), $lte: thirtyDaysAhead },
  })
    .populate('product', 'sku name')
    .sort({ expiresOn: 1 })
    .limit(6)
    .lean();

  // 7. 7-Day Activity Trend (Movement Ledger)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const activityAgg = await StockLedgerEntry.aggregate([
    {
      $match: {
        ...matchWarehouse,
        createdAt: { $gte: sevenDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          isPositive: { $gte: ['$quantity', 0] },
        },
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  return {
    valuation: {
      totalQuantity: valuationData.totalQuantity,
      totalReserved: valuationData.totalReserved,
      totalCostValueMinor: valuationData.totalCostValueMinor,
      totalSaleValueMinor: valuationData.totalSaleValueMinor,
    },
    inboundVelocity: {
      openPurchaseOrders: openPOs,
      pendingPutaways,
    },
    outboundVelocity: {
      ordersPending,
      ordersPicking,
      dispatchedToday,
    },
    audits: {
      activeCycleCounts: activeCounts,
      pendingAdjustments,
      accuracyRate,
    },
    criticalAlerts: lowStockAgg,
    expiringBatches: expiringBatches.map((b) => ({
      batchNumber: b.batchNumber,
      sku: b.product?.sku,
      name: b.product?.name,
      expiresOn: b.expiresOn,
      daysRemaining: Math.max(0, Math.ceil((new Date(b.expiresOn) - new Date()) / 86400000)),
    })),
    activityTrend: activityAgg,
  };
};

/**
 * Generates itemized stock valuation and financial inventory asset report.
 *
 * @param {object} [filters={}] - Facility and category filters.
 * @returns {Promise<object>} Itemized valuation dataset and summary.
 */
export const getInventoryValuationReport = async (filters = {}) => {
  const match = { onHand: { $gt: 0 } };
  if (filters.warehouse) {
    match.warehouse = new mongoose.Types.ObjectId(filters.warehouse);
  }

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
  ];

  if (filters.category) {
    pipeline.push({
      $match: { 'product.category': new mongoose.Types.ObjectId(filters.category) },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouse',
        foreignField: '_id',
        as: 'warehouse',
      },
    },
    { $unwind: { path: '$warehouse', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          product: '$product._id',
          warehouse: '$warehouse._id',
        },
        sku: { $first: '$product.sku' },
        name: { $first: '$product.name' },
        categoryName: { $first: '$category.name' },
        warehouseCode: { $first: '$warehouse.code' },
        warehouseName: { $first: '$warehouse.name' },
        onHand: { $sum: '$onHand' },
        reserved: { $sum: '$reserved' },
        costPriceMinor: { $first: { $ifNull: ['$product.costPriceMinor', 0] } },
        salePriceMinor: { $first: { $ifNull: ['$product.salePriceMinor', 0] } },
      },
    },
    {
      $project: {
        sku: 1,
        name: 1,
        categoryName: { $ifNull: ['$categoryName', 'Uncategorized'] },
        warehouseCode: { $ifNull: ['$warehouseCode', '—'] },
        warehouseName: { $ifNull: ['$warehouseName', '—'] },
        onHand: 1,
        reserved: 1,
        available: { $subtract: ['$onHand', '$reserved'] },
        costPriceMinor: 1,
        salePriceMinor: 1,
        totalCostMinor: { $multiply: ['$onHand', '$costPriceMinor'] },
        totalSaleMinor: { $multiply: ['$onHand', '$salePriceMinor'] },
        marginMinor: {
          $multiply: [
            '$onHand',
            { $subtract: ['$salePriceMinor', '$costPriceMinor'] },
          ],
        },
      },
    },
    { $sort: { totalCostMinor: -1 } },
  );

  const items = await StockBalance.aggregate(pipeline);

  const summary = items.reduce(
    (acc, it) => {
      acc.totalQuantity += it.onHand;
      acc.totalReserved += it.reserved;
      acc.totalCostMinor += it.totalCostMinor;
      acc.totalSaleMinor += it.totalSaleMinor;
      acc.totalMarginMinor += it.marginMinor;
      return acc;
    },
    {
      totalSkus: items.length,
      totalQuantity: 0,
      totalReserved: 0,
      totalCostMinor: 0,
      totalSaleMinor: 0,
      totalMarginMinor: 0,
    },
  );

  return { items, summary };
};

/**
 * Calculates stock velocity and inventory turnover over a rolling time window.
 *
 * @param {object} [filters={}] - Filter parameters.
 * @returns {Promise<object>} Turnover ratios and velocity categories.
 */
export const getInventoryTurnoverReport = async (filters = {}) => {
  const windowDays = filters.timeWindowDays || 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - windowDays);

  const matchMovement = {
    movementType: MOVEMENT_TYPES.SALES_ISSUE,
    createdAt: { $gte: startDate },
  };

  if (filters.warehouse) {
    matchMovement.warehouse = new mongoose.Types.ObjectId(filters.warehouse);
  }

  // Aggregate issues over time window
  const issuesAgg = await StockLedgerEntry.aggregate([
    { $match: matchMovement },
    {
      $group: {
        _id: '$product',
        totalIssued: { $sum: { $abs: '$quantity' } },
        issueCount: { $sum: 1 },
      },
    },
  ]);

  const issuesMap = new Map();
  for (const it of issuesAgg) {
    issuesMap.set(String(it._id), it);
  }

  // Get on-hand stock for all products
  const matchBalance = filters.warehouse
    ? { warehouse: new mongoose.Types.ObjectId(filters.warehouse) }
    : {};

  const balanceAgg = await StockBalance.aggregate([
    { $match: matchBalance },
    {
      $group: {
        _id: '$product',
        totalOnHand: { $sum: '$onHand' },
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories',
        localField: 'product.category',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        sku: '$product.sku',
        name: '$product.name',
        categoryName: { $ifNull: ['$category.name', 'Uncategorized'] },
        costPriceMinor: { $ifNull: ['$product.costPriceMinor', 0] },
        totalOnHand: 1,
      },
    },
  ]);

  let fastCount = 0;
  let mediumCount = 0;
  let slowCount = 0;
  let deadStockCount = 0;

  const items = balanceAgg.map((p) => {
    const issueStats = issuesMap.get(String(p._id)) || { totalIssued: 0, issueCount: 0 };
    const issuedQty = issueStats.totalIssued;
    const turnoverRatio = p.totalOnHand > 0 ? Number((issuedQty / p.totalOnHand).toFixed(2)) : 0;

    let velocity = 'DEAD_STOCK';
    if (issuedQty > 0) {
      if (turnoverRatio >= 2.0) {
        velocity = 'FAST_MOVING';
        fastCount += 1;
      } else if (turnoverRatio >= 0.75) {
        velocity = 'MEDIUM_MOVING';
        mediumCount += 1;
      } else {
        velocity = 'SLOW_MOVING';
        slowCount += 1;
      }
    } else {
      deadStockCount += 1;
    }

    return {
      productId: p._id,
      sku: p.sku,
      name: p.name,
      categoryName: p.categoryName,
      onHand: p.totalOnHand,
      issuedQty,
      turnoverRatio,
      velocity,
    };
  });

  items.sort((a, b) => b.turnoverRatio - a.turnoverRatio);

  return {
    items,
    summary: {
      timeWindowDays: windowDays,
      totalProductsEvaluated: items.length,
      fastMovingCount: fastCount,
      mediumMovingCount: mediumCount,
      slowMovingCount: slowCount,
      deadStockCount,
    },
  };
};

/**
 * Computes batch shelf-life aging and expiry risk categorization.
 *
 * @param {object} [filters={}] - Filter parameters.
 * @returns {Promise<object>} Batch expiration breakdown.
 */
export const getBatchAgingReport = async (filters = {}) => {
  const matchBalance = {
    batch: { $ne: null },
    onHand: { $gt: 0 },
  };

  if (filters.warehouse) {
    matchBalance.warehouse = new mongoose.Types.ObjectId(filters.warehouse);
  }

  const batchBalances = await StockBalance.aggregate([
    { $match: matchBalance },
    {
      $lookup: {
        from: 'batches',
        localField: 'batch',
        foreignField: '_id',
        as: 'batchDoc',
      },
    },
    { $unwind: '$batchDoc' },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDoc',
      },
    },
    { $unwind: '$productDoc' },
    {
      $lookup: {
        from: 'locations',
        localField: 'location',
        foreignField: '_id',
        as: 'locationDoc',
      },
    },
    { $unwind: { path: '$locationDoc', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'warehouses',
        localField: 'warehouse',
        foreignField: '_id',
        as: 'warehouseDoc',
      },
    },
    { $unwind: { path: '$warehouseDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        batchNumber: '$batchDoc.batchNumber',
        expiresOn: '$batchDoc.expiresOn',
        sku: '$productDoc.sku',
        productName: '$productDoc.name',
        costPriceMinor: { $ifNull: ['$productDoc.costPriceMinor', 0] },
        locationCode: { $ifNull: ['$locationDoc.code', '—'] },
        warehouseCode: { $ifNull: ['$warehouseDoc.code', '—'] },
        onHand: 1,
      },
    },
  ]);

  const now = new Date();
  let expiredCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let healthyCount = 0;
  let totalAtRiskCostMinor = 0;

  const items = batchBalances.map((b) => {
    const exp = b.expiresOn ? new Date(b.expiresOn) : null;
    let daysRemaining = null;
    let status = 'NO_EXPIRY';

    if (exp) {
      daysRemaining = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        status = 'EXPIRED';
        expiredCount += 1;
        totalAtRiskCostMinor += b.onHand * b.costPriceMinor;
      } else if (daysRemaining <= 30) {
        status = 'CRITICAL';
        criticalCount += 1;
        totalAtRiskCostMinor += b.onHand * b.costPriceMinor;
      } else if (daysRemaining <= 90) {
        status = 'WARNING';
        warningCount += 1;
      } else {
        status = 'HEALTHY';
        healthyCount += 1;
      }
    }

    return {
      batchNumber: b.batchNumber,
      sku: b.sku,
      productName: b.productName,
      warehouseCode: b.warehouseCode,
      locationCode: b.locationCode,
      onHand: b.onHand,
      expiresOn: b.expiresOn,
      daysRemaining,
      status,
      costPriceMinor: b.costPriceMinor,
      valuationMinor: b.onHand * b.costPriceMinor,
    };
  });

  items.sort((a, b) => {
    if (a.daysRemaining === null) {
      return 1;
    }
    if (b.daysRemaining === null) {
      return -1;
    }
    return a.daysRemaining - b.daysRemaining;
  });

  return {
    items,
    summary: {
      totalBatches: items.length,
      expiredCount,
      criticalCount,
      warningCount,
      healthyCount,
      totalAtRiskCostMinor,
    },
  };
};

/**
 * Aggregates inventory variance, cycle counting discrepancies, and write-off audits.
 *
 * @param {object} [filters={}] - Filter parameters.
 * @returns {Promise<object>} Discrepancy analysis dataset.
 */
export const getDiscrepancyReport = async (filters = {}) => {
  const match = {
    movementType: {
      $in: [
        MOVEMENT_TYPES.ADJUSTMENT_GAIN,
        MOVEMENT_TYPES.ADJUSTMENT_LOSS,
        MOVEMENT_TYPES.WRITE_OFF,
      ],
    },
  };

  if (filters.warehouse) {
    match.warehouse = new mongoose.Types.ObjectId(filters.warehouse);
  }

  if (filters.startDate || filters.endDate) {
    match.createdAt = {};
    if (filters.startDate) {
      match.createdAt.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      match.createdAt.$lte = new Date(filters.endDate);
    }
  }

  const entries = await StockLedgerEntry.find(match)
    .populate('product', 'sku name costPriceMinor')
    .populate('warehouse', 'code name')
    .populate('location', 'code')
    .sort({ createdAt: -1 })
    .lean();

  let totalGainQty = 0;
  let totalLossQty = 0;
  let totalWriteOffQty = 0;
  let totalGainValueMinor = 0;
  let totalLossValueMinor = 0;

  const items = entries.map((e) => {
    const cost = e.product?.costPriceMinor || 0;
    const valueMinor = Math.round(e.quantity * cost);

    if (e.movementType === MOVEMENT_TYPES.ADJUSTMENT_GAIN) {
      totalGainQty += e.quantity;
      totalGainValueMinor += valueMinor;
    } else if (e.movementType === MOVEMENT_TYPES.ADJUSTMENT_LOSS) {
      totalLossQty += Math.abs(e.quantity);
      totalLossValueMinor += Math.abs(valueMinor);
    } else if (e.movementType === MOVEMENT_TYPES.WRITE_OFF) {
      totalWriteOffQty += Math.abs(e.quantity);
      totalLossValueMinor += Math.abs(valueMinor);
    }

    return {
      date: e.createdAt,
      referenceNo: e.referenceNo || '—',
      movementType: e.movementType,
      warehouseCode: e.warehouse?.code || '—',
      locationCode: e.location?.code || '—',
      sku: e.product?.sku || '—',
      productName: e.product?.name || '—',
      quantity: e.quantity,
      valueMinor,
      reason: e.reason || '—',
    };
  });

  return {
    items,
    summary: {
      totalEntries: items.length,
      totalGainQty,
      totalLossQty,
      totalWriteOffQty,
      netQuantity: totalGainQty - totalLossQty - totalWriteOffQty,
      totalGainValueMinor,
      totalLossValueMinor,
      netValueMinor: totalGainValueMinor - totalLossValueMinor,
    },
  };
};

/**
 * Serializes report datasets into formatted RFC 4180 compliant CSV string.
 *
 * @param {string} reportType - Report identifier.
 * @param {object} filters - Report query filters.
 * @returns {Promise<string>} Generated CSV text.
 */
export const exportReportToCsv = async (reportType, filters) => {
  const escapeCell = (val) => {
    if (val === null || val === undefined) {
      return '';
    }
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [];

  if (reportType === 'valuation') {
    const { items } = await getInventoryValuationReport(filters);
    rows.push([
      'SKU',
      'Product Name',
      'Category',
      'Warehouse Code',
      'On Hand Qty',
      'Reserved Qty',
      'Available Qty',
      'Unit Cost ($)',
      'Unit Sale ($)',
      'Total Cost Valuation ($)',
      'Total Retail Valuation ($)',
      'Unrealized Margin ($)',
    ]);
    for (const it of items) {
      rows.push([
        it.sku,
        it.name,
        it.categoryName,
        it.warehouseCode,
        it.onHand,
        it.reserved,
        it.available,
        (it.costPriceMinor / 100).toFixed(2),
        (it.salePriceMinor / 100).toFixed(2),
        (it.totalCostMinor / 100).toFixed(2),
        (it.totalSaleMinor / 100).toFixed(2),
        (it.marginMinor / 100).toFixed(2),
      ]);
    }
  } else if (reportType === 'turnover') {
    const { items } = await getInventoryTurnoverReport(filters);
    rows.push([
      'SKU',
      'Product Name',
      'Category',
      'On Hand Qty',
      'Total Issues (90d)',
      'Turnover Ratio',
      'Velocity Classification',
    ]);
    for (const it of items) {
      rows.push([
        it.sku,
        it.name,
        it.categoryName,
        it.onHand,
        it.issuedQty,
        it.turnoverRatio,
        it.velocity,
      ]);
    }
  } else if (reportType === 'aging') {
    const { items } = await getBatchAgingReport(filters);
    rows.push([
      'Batch #',
      'SKU',
      'Product Name',
      'Warehouse',
      'Location',
      'On Hand Qty',
      'Expiry Date',
      'Days Remaining',
      'Risk Status',
      'Valuation ($)',
    ]);
    for (const it of items) {
      rows.push([
        it.batchNumber,
        it.sku,
        it.productName,
        it.warehouseCode,
        it.locationCode,
        it.onHand,
        it.expiresOn ? new Date(it.expiresOn).toISOString().split('T')[0] : 'None',
        it.daysRemaining !== null ? it.daysRemaining : '—',
        it.status,
        (it.valuationMinor / 100).toFixed(2),
      ]);
    }
  } else if (reportType === 'discrepancies') {
    const { items } = await getDiscrepancyReport(filters);
    rows.push([
      'Date',
      'Reference #',
      'Movement Type',
      'Warehouse',
      'Location',
      'SKU',
      'Product Name',
      'Quantity',
      'Valuation ($)',
      'Audit Justification',
    ]);
    for (const it of items) {
      rows.push([
        new Date(it.date).toISOString().split('T')[0],
        it.referenceNo,
        it.movementType,
        it.warehouseCode,
        it.locationCode,
        it.sku,
        it.productName,
        it.quantity,
        (it.valueMinor / 100).toFixed(2),
        it.reason,
      ]);
    }
  }

  return rows.map((r) => r.map(escapeCell).join(',')).join('\n');
};
