/**
 * StockPilot WMS - Inventory Queries & Administrative Services.
 *
 * Provides query endpoints for real-time balances, immutable ledger history,
 * warehouse product availability, opening stock posting, and ledger entry reversals.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { StockBalance } from './stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from './stockLedgerEntry.model.js';
import { Batch } from './batch.model.js';
import { Product, TRACKING_TYPES } from '../products/product.model.js';
import { postMovements } from './stockPosting.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

/**
 * Lists stock balances matching filter criteria with pagination.
 *
 * @param {object} query - Balances query parameters.
 * @returns {Promise<{items: object[], meta: object}>} Paginated stock balances.
 */
export const listBalances = async (query = {}) => {
  const {
    warehouse,
    product,
    location,
    category,
    inStockOnly = 'true',
    page = 1,
    limit = 20,
  } = query;

  const filter = {};
  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (product) {
    filter.product = product;
  }
  if (location) {
    filter.location = location;
  }

  if (category) {
    const matchingProducts = await Product.find({ category }).select('_id');
    const productIds = matchingProducts.map((p) => p._id);
    if (filter.product) {
      filter.$and = [{ product: filter.product }, { product: { $in: productIds } }];
      delete filter.product;
    } else {
      filter.product = { $in: productIds };
    }
  }

  if (inStockOnly === 'true' || inStockOnly === true) {
    filter.onHand = { $gt: 0 };
  }

  const [items, total] = await Promise.all([
    StockBalance.find(filter)
      .populate('product', 'sku name barcode tracking unit')
      .populate({
        path: 'product',
        populate: { path: 'unit', select: 'name code allowDecimals' },
      })
      .populate('warehouse', 'name code')
      .populate('location', 'path code type purpose')
      .populate('batch', 'batchNumber expiresOn status')
      .sort({ updatedAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    StockBalance.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Lists historical stock ledger movements matching audit filter criteria.
 *
 * @param {object} query - Ledger query filters.
 * @returns {Promise<{items: object[], meta: object}>} Paginated ledger entries.
 */
export const listLedgerEntries = async (query = {}) => {
  const {
    warehouse,
    product,
    location,
    movementType,
    referenceType,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = query;

  const filter = {};
  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (product) {
    filter.product = product;
  }
  if (location) {
    filter.location = location;
  }
  if (movementType) {
    filter.movementType = movementType;
  }
  if (referenceType) {
    filter.referenceType = referenceType;
  }

  if (fromDate || toDate) {
    filter.postingDate = {};
    if (fromDate) {
      filter.postingDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      filter.postingDate.$lte = new Date(toDate);
    }
  }

  const [items, total] = await Promise.all([
    StockLedgerEntry.find(filter)
      .populate('product', 'sku name barcode unit')
      .populate('warehouse', 'name code')
      .populate('location', 'path code type purpose')
      .populate('batch', 'batchNumber expiresOn')
      .populate('createdBy', 'firstName lastName email role')
      .sort({ postingDate: -1, _id: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    StockLedgerEntry.countDocuments(filter),
  ]);

  const itemIds = items.map((i) => i._id);
  const reversals = await StockLedgerEntry.find({
    reversalOf: { $in: itemIds },
  })
    .select('_id reversalOf referenceNo postingDate')
    .lean();

  const reversalMap = new Map();
  for (const rev of reversals) {
    if (rev.reversalOf) {
      reversalMap.set(rev.reversalOf.toString(), {
        reversalId: rev._id,
        referenceNo: rev.referenceNo,
        postingDate: rev.postingDate,
      });
    }
  }

  const enrichedItems = items.map((doc) => {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    const revInfo = reversalMap.get(doc._id.toString());
    obj.isReversed = Boolean(revInfo);
    obj.reversalInfo = revInfo || null;
    return obj;
  });

  return {
    items: enrichedItems,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Computes aggregate stock availability metrics for a product within a warehouse.
 *
 * @param {object} criteria - Search criteria.
 * @param {string} criteria.warehouseId - Warehouse identifier.
 * @param {string} criteria.productId - Product identifier.
 * @returns {Promise<object>} Aggregate availability and location breakdown.
 */
export const getAvailability = async ({ warehouseId, productId }) => {
  const balances = await StockBalance.find({
    warehouse: warehouseId,
    product: productId,
  })
    .populate('location', 'path code type purpose')
    .populate('batch', 'batchNumber expiresOn status');

  const onHand = balances.reduce((sum, b) => sum + (b.onHand || 0), 0);
  const reserved = balances.reduce((sum, b) => sum + (b.reserved || 0), 0);
  const available = Math.max(0, onHand - reserved);

  return {
    warehouse: warehouseId,
    product: productId,
    onHand,
    reserved,
    available,
    breakdown: balances,
  };
};

/**
 * Returns comprehensive stock balances for a product across all warehouses.
 *
 * @param {string} productId - Product identifier.
 * @returns {Promise<object[]>} List of balance entries with location details.
 */
export const getProductStockDetails = async (productId) => {
  return StockBalance.find({
    product: productId,
    onHand: { $gt: 0 },
  })
    .populate('warehouse', 'name code')
    .populate('location', 'path code type purpose')
    .populate('batch', 'batchNumber expiresOn status')
    .sort({ warehouse: 1, 'location.path': 1 });
};

/**
 * Posts initial opening stock balances for an existing warehouse.
 *
 * @param {object} params - Opening stock parameters.
 * @param {string} params.warehouseId - Warehouse where stock is physically placed.
 * @param {object[]} params.items - Opening balance line items.
 * @param {object} params.actor - Authenticated administrator or manager.
 * @returns {Promise<object[]>} Created ledger entries.
 * @throws {ApiError} When validation fails or transaction aborts.
 */
export const postOpeningBalance = async ({ warehouseId, items, actor }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('At least one opening stock item is required');
  }

  const session = await mongoose.startSession();
  try {
    let ledgerEntries;
    await session.withTransaction(async () => {
      const movements = [];
      const referenceId = new mongoose.Types.ObjectId();

      for (let idx = 0; idx < items.length; idx += 1) {
        const item = items[idx];
        const product = await Product.findById(item.product).session(session);
        if (!product || !product.isActive) {
          throw ApiError.unprocessable(`Product not found or inactive: ${item.product}`);
        }

        let batchId = null;
        const tracking = product.trackingType || product.tracking;
        if (tracking === TRACKING_TYPES.BATCH) {
          if (!item.batchNumber) {
            throw ApiError.badRequest(
              `Batch number is required for tracked product ${product.sku}`,
            );
          }
          let batchDoc = await Batch.findOne({
            product: product._id,
            batchNumber: item.batchNumber.toUpperCase().trim(),
          }).session(session);

          if (!batchDoc) {
            const [created] = await Batch.create(
              [
                {
                  product: product._id,
                  batchNumber: item.batchNumber.toUpperCase().trim(),
                  expiresOn: item.expiresOn ? new Date(item.expiresOn) : null,
                },
              ],
              { session },
            );
            batchDoc = created;
          }
          batchId = batchDoc._id;
        }

        movements.push({
          movementType: MOVEMENT_TYPES.OPENING_BALANCE,
          product: product._id,
          warehouse: warehouseId,
          location: item.location,
          batch: batchId,
          quantity: item.quantity,
          unitCostMinor: item.unitCostMinor ?? 0,
          referenceType: 'OPENING_BALANCE',
          referenceId,
          referenceNo: `INIT-${Date.now()}`,
          lineId: new mongoose.Types.ObjectId(),
          reason: item.reason || 'Initial Opening Balance Entry',
        });
      }

      ledgerEntries = await postMovements({
        movements,
        session,
        actor,
      });
    });

    return ledgerEntries;
  } finally {
    await session.endSession();
  }
};

/**
 * Posts an equal-and-opposite reversal of a historical stock ledger movement.
 *
 * @param {object} params - Reversal criteria.
 * @param {string} params.entryId - Ledger entry to reverse.
 * @param {string} params.reason - Audit explanation for the reversal.
 * @param {object} params.actor - Authenticated user issuing the reversal.
 * @returns {Promise<object>} Created reversal ledger entry.
 * @throws {ApiError} When entry is missing, already reversed, or stock is insufficient.
 */
export const reverseLedgerEntry = async ({ entryId, reason, actor }) => {
  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('A reason is mandatory when reversing a stock ledger entry');
  }

  const original = await StockLedgerEntry.findById(entryId);
  if (!original) {
    throw ApiError.notFound('Stock ledger entry not found');
  }

  if (original.movementType === MOVEMENT_TYPES.REVERSAL) {
    throw ApiError.badRequest('Cannot reverse an entry that is already a reversal');
  }

  const existingReversal = await StockLedgerEntry.findOne({
    reversalOf: original._id,
  });

  if (existingReversal) {
    throw ApiError.conflict(
      `Ledger entry ${entryId} has already been reversed by entry ${existingReversal._id}`,
    );
  }

  const reversalMovement = {
    movementType: MOVEMENT_TYPES.REVERSAL,
    product: original.product,
    warehouse: original.warehouse,
    location: original.location,
    batch: original.batch,
    serial: original.serial,
    quantity: -original.quantity,
    unitCostMinor: original.unitCostMinor,
    referenceType: 'REVERSAL',
    referenceId: original._id,
    referenceNo: `REV-${original._id}`,
    reason: reason.trim(),
    reversalOf: original._id,
  };

  const [reversalEntry] = await postMovements({
    movements: [reversalMovement],
    actor,
  });

  return reversalEntry;
};
