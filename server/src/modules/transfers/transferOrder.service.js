/**
 * StockPilot WMS - Transfers & Replenishment Service.
 *
 * Implements intra-warehouse bin-to-bin relocations, inter-warehouse facility
 * in-transit transfers, and automated min/max forward pick face replenishment.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import {
  TransferOrder,
  TRANSFER_STATUSES,
} from './transferOrder.model.js';
import { ReplenishmentRule } from './replenishmentRule.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Product } from '../products/product.model.js';
import { Location } from '../locations/location.model.js';
import { StockBalance } from '../inventory/stockBalance.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Generates formatted sequence number for transfer orders (e.g. TO-2026-0001).
 *
 * @returns {Promise<string>} Next sequence string.
 */
export const generateTransferNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `TO-${year}-`;
  const count = await TransferOrder.countDocuments({
    transferNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
};

/**
 * Performs an immediate atomic bin-to-bin inventory relocation inside a warehouse.
 *
 * @param {object} payload - Relocation parameters.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Resulting balance information.
 */
export const executeDirectBinTransfer = async (payload, actor) => {
  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.badRequest('Target warehouse not found or is inactive');
  }

  const [product, sourceLoc, destLoc] = await Promise.all([
    Product.findById(payload.product),
    Location.findById(payload.sourceLocation),
    Location.findById(payload.destinationLocation),
  ]);

  if (!product || !product.isActive) {
    throw ApiError.badRequest('Product not found or inactive');
  }

  if (!sourceLoc || !sourceLoc.isActive || !destLoc || !destLoc.isActive) {
    throw ApiError.badRequest('Source or destination location not found or inactive');
  }

  if (
    String(sourceLoc.warehouse) !== String(warehouse._id) ||
    String(destLoc.warehouse) !== String(warehouse._id)
  ) {
    throw ApiError.badRequest('Both locations must belong to the specified warehouse');
  }

  const qty = Number(payload.quantity);
  if (qty <= 0) {
    throw ApiError.badRequest('Transfer quantity must be greater than zero');
  }

  const sourceBalance = await StockBalance.findOne({
    warehouse: warehouse._id,
    product: product._id,
    location: sourceLoc._id,
    batch: payload.batch || null,
  });

  const available = sourceBalance ? sourceBalance.available : 0;
  if (available < qty) {
    throw ApiError.badRequest(
      `Insufficient available stock at source location (available: ${available}, requested: ${qty})`,
    );
  }

  const transferRefId = new mongoose.Types.ObjectId().toString();
  const transferRefNo = `DIR-${Date.now()}`;

  const movements = [
    {
      movementType: MOVEMENT_TYPES.TRANSFER_OUT,
      product: product._id,
      warehouse: warehouse._id,
      location: sourceLoc._id,
      quantity: -qty,
      batch: payload.batch || null,
      serials: payload.serials || [],
      consumesReservation: false,
      referenceType: 'BIN_TRANSFER',
      referenceId: transferRefId,
      referenceNo: transferRefNo,
      lineId: '1',
      reason: payload.notes || 'Intra-warehouse bin relocation',
    },
    {
      movementType: MOVEMENT_TYPES.TRANSFER_IN,
      product: product._id,
      warehouse: warehouse._id,
      location: destLoc._id,
      quantity: qty,
      batch: payload.batch || null,
      serials: payload.serials || [],
      consumesReservation: false,
      referenceType: 'BIN_TRANSFER',
      referenceId: transferRefId,
      referenceNo: transferRefNo,
      lineId: '2',
      reason: payload.notes || 'Intra-warehouse bin relocation',
    },
  ];

  await postMovements({ movements, actor });

  const [sourceBal, destBal] = await Promise.all([
    StockBalance.findOne({ product: product._id, location: sourceLoc._id }),
    StockBalance.findOne({ product: product._id, location: destLoc._id }),
  ]);

  return {
    success: true,
    message: 'Direct bin transfer completed successfully',
    sourceBalance: sourceBal,
    destinationBalance: destBal,
  };
};

/**
 * Creates a new Transfer Order (inter-warehouse facility or intra-warehouse plan).
 *
 * @param {object} payload - Transfer order data.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created transfer order document.
 */
export const createTransferOrder = async (payload, actor) => {
  const [originWh, destWh] = await Promise.all([
    Warehouse.findById(payload.originWarehouse),
    Warehouse.findById(payload.destinationWarehouse),
  ]);

  if (!originWh || !originWh.isActive || !destWh || !destWh.isActive) {
    throw ApiError.badRequest('Origin or destination warehouse not found or inactive');
  }

  const validatedItems = [];
  for (const item of payload.items) {
    const product = await Product.findById(item.product);
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product ${item.product} not found or inactive`);
    }

    const sourceLoc = await Location.findById(item.sourceLocation);
    if (!sourceLoc || String(sourceLoc.warehouse) !== String(originWh._id)) {
      throw ApiError.badRequest('Source location must belong to the origin warehouse');
    }

    let destinationLocation = null;
    if (item.destinationLocation) {
      const dLoc = await Location.findById(item.destinationLocation);
      if (!dLoc || String(dLoc.warehouse) !== String(destWh._id)) {
        throw ApiError.badRequest('Destination location must belong to the destination warehouse');
      }
      destinationLocation = dLoc._id;
    }

    validatedItems.push({
      product: product._id,
      requestedQty: Number(item.requestedQty),
      dispatchedQty: 0,
      receivedQty: 0,
      sourceLocation: sourceLoc._id,
      destinationLocation,
      batch: item.batch || null,
      serials: item.serials || [],
    });
  }

  const transferNumber = await generateTransferNumber();

  const to = await TransferOrder.create({
    transferNumber,
    transferType: payload.transferType,
    originWarehouse: originWh._id,
    destinationWarehouse: destWh._id,
    status: TRANSFER_STATUSES.PENDING_DISPATCH,
    items: validatedItems,
    carrier: payload.carrier || '',
    trackingNumber: payload.trackingNumber || '',
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return getTransferOrderById(to._id);
};

/**
 * Lists paginated transfer orders with filters.
 *
 * @param {object} [filters={}] - Filter options.
 * @param {object} [pagination={}] - Pagination parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Paginated transfer orders.
 */
export const listTransferOrders = async (filters = {}, pagination = {}) => {
  const query = {};

  if (filters.originWarehouse) {
    query.originWarehouse = filters.originWarehouse;
  }
  if (filters.destinationWarehouse) {
    query.destinationWarehouse = filters.destinationWarehouse;
  }
  if (filters.transferType) {
    query.transferType = filters.transferType;
  }
  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    const term = filters.search.trim();
    query.$or = [
      { transferNumber: { $regex: term, $options: 'i' } },
      { carrier: { $regex: term, $options: 'i' } },
      { trackingNumber: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    TransferOrder.find(query)
      .populate('originWarehouse', 'code name')
      .populate('destinationWarehouse', 'code name')
      .populate('items.product', 'sku name trackingType')
      .populate('items.sourceLocation', 'code path')
      .populate('items.destinationLocation', 'code path')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    TransferOrder.countDocuments(query),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves a single transfer order document by ID.
 *
 * @param {string} id - Transfer order identifier.
 * @returns {Promise<object>} Populated document.
 */
export const getTransferOrderById = async (id) => {
  const to = await TransferOrder.findById(id)
    .populate('originWarehouse', 'code name address')
    .populate('destinationWarehouse', 'code name address')
    .populate('items.product', 'sku name trackingType salePriceMinor costPriceMinor')
    .populate('items.sourceLocation', 'code path type purpose')
    .populate('items.destinationLocation', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn')
    .populate('createdBy', 'name email');

  if (!to) {
    throw ApiError.notFound('Transfer Order not found');
  }

  return to;
};

/**
 * Dispatches an inter-warehouse transfer order, deducting inventory from origin warehouse.
 *
 * @param {string} id - Transfer order ID.
 * @param {object} payload - Dispatch metadata.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Dispatched transfer order.
 */
export const dispatchTransferOrder = async (id, payload, actor) => {
  const to = await TransferOrder.findById(id);
  if (!to) {
    throw ApiError.notFound('Transfer Order not found');
  }

  if (
    to.status !== TRANSFER_STATUSES.DRAFT &&
    to.status !== TRANSFER_STATUSES.PENDING_DISPATCH
  ) {
    throw ApiError.badRequest(
      `Cannot dispatch transfer order in status ${to.status}`,
    );
  }

  const session = await mongoose.startSession();
  try {
    let updatedDoc;
    await session.withTransaction(async () => {
      const activeTo = await TransferOrder.findById(id).session(session);
      const movements = [];

      const dispatchMap = new Map();
      if (payload.items) {
        for (const item of payload.items) {
          dispatchMap.set(String(item.itemId), Number(item.dispatchedQty));
        }
      }

      for (const line of activeTo.items) {
        const qty = dispatchMap.has(String(line._id))
          ? dispatchMap.get(String(line._id))
          : line.requestedQty;

        if (qty <= 0) {
          throw ApiError.badRequest('Dispatched quantity must be greater than zero');
        }

        line.dispatchedQty = qty;

        movements.push({
          movementType: MOVEMENT_TYPES.TRANSFER_OUT,
          product: line.product,
          warehouse: activeTo.originWarehouse,
          location: line.sourceLocation,
          quantity: -qty,
          batch: line.batch || null,
          serials: line.serials || [],
          consumesReservation: false,
          referenceType: 'TRANSFER_ORDER',
          referenceId: activeTo._id.toString(),
          referenceNo: activeTo.transferNumber,
          lineId: String(line._id),
          reason: `Inter-warehouse transit dispatch to ${activeTo.transferNumber}`,
        });
      }

      await postMovements({ movements, actor, session });

      activeTo.status = TRANSFER_STATUSES.IN_TRANSIT;
      activeTo.dispatchedAt = new Date();
      if (payload.carrier) {
        activeTo.carrier = payload.carrier.trim();
      }
      if (payload.trackingNumber) {
        activeTo.trackingNumber = payload.trackingNumber.trim();
      }
      if (payload.notes) {
        activeTo.notes = payload.notes.trim();
      }

      await activeTo.save({ session });
      updatedDoc = activeTo;
    });

    return getTransferOrderById(updatedDoc._id);
  } finally {
    await session.endSession();
  }
};

/**
 * Receives an in-transit transfer order at destination warehouse, crediting inventory.
 *
 * @param {string} id - Transfer order ID.
 * @param {object} payload - Receiving intake items with destination bins.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Completed transfer order.
 */
export const receiveTransferOrder = async (id, payload, actor) => {
  const to = await TransferOrder.findById(id);
  if (!to) {
    throw ApiError.notFound('Transfer Order not found');
  }

  if (to.status !== TRANSFER_STATUSES.IN_TRANSIT) {
    throw ApiError.badRequest(
      `Cannot receive transfer order with status ${to.status}. Order must be IN_TRANSIT.`,
    );
  }

  const session = await mongoose.startSession();
  try {
    let updatedDoc;
    await session.withTransaction(async () => {
      const activeTo = await TransferOrder.findById(id).session(session);
      const movements = [];

      for (const intake of payload.items) {
        const line = activeTo.items.find((it) => String(it._id) === String(intake.itemId));
        if (!line) {
          throw ApiError.badRequest(`Transfer item line ${intake.itemId} not found`);
        }

        const destLoc = await Location.findById(intake.destinationLocationId).session(session);
        if (!destLoc || String(destLoc.warehouse) !== String(activeTo.destinationWarehouse)) {
          throw ApiError.badRequest(
            'Destination location not found or does not belong to destination warehouse',
          );
        }

        const qty = Number(intake.receivedQty);
        if (qty <= 0) {
          throw ApiError.badRequest('Received quantity must be positive');
        }

        line.receivedQty = qty;
        line.destinationLocation = destLoc._id;

        movements.push({
          movementType: MOVEMENT_TYPES.TRANSFER_IN,
          product: line.product,
          warehouse: activeTo.destinationWarehouse,
          location: destLoc._id,
          quantity: qty,
          batch: line.batch || null,
          serials: line.serials || [],
          consumesReservation: false,
          referenceType: 'TRANSFER_ORDER',
          referenceId: activeTo._id.toString(),
          referenceNo: activeTo.transferNumber,
          lineId: String(line._id),
          reason: `Inter-warehouse receipt from ${activeTo.transferNumber}`,
        });
      }

      await postMovements({ movements, actor, session });

      activeTo.status = TRANSFER_STATUSES.COMPLETED;
      activeTo.receivedAt = new Date();
      await activeTo.save({ session });
      updatedDoc = activeTo;
    });

    return getTransferOrderById(updatedDoc._id);
  } finally {
    await session.endSession();
  }
};

/**
 * Cancels a pending transfer order.
 *
 * @param {string} id - Transfer order ID.
 * @returns {Promise<object>} Cancelled document.
 */
export const cancelTransferOrder = async (id) => {
  const to = await TransferOrder.findById(id);
  if (!to) {
    throw ApiError.notFound('Transfer Order not found');
  }

  if (to.status === TRANSFER_STATUSES.IN_TRANSIT || to.status === TRANSFER_STATUSES.COMPLETED) {
    throw ApiError.badRequest(`Cannot cancel transfer order in status ${to.status}`);
  }

  to.status = TRANSFER_STATUSES.CANCELLED;
  await to.save();
  return getTransferOrderById(id);
};

/**
 * Upserts a Min/Max Replenishment Rule for a forward pick face bin.
 *
 * @param {object} payload - Rule configuration.
 * @returns {Promise<object>} Created or updated rule.
 */
export const upsertReplenishmentRule = async (payload) => {
  const [warehouse, product, location] = await Promise.all([
    Warehouse.findById(payload.warehouse),
    Product.findById(payload.product),
    Location.findById(payload.location),
  ]);

  if (!warehouse || !product || !location) {
    throw ApiError.badRequest('Invalid warehouse, product, or location specified');
  }

  if (String(location.warehouse) !== String(warehouse._id)) {
    throw ApiError.badRequest('Location must belong to the specified warehouse');
  }

  const rule = await ReplenishmentRule.findOneAndUpdate(
    {
      warehouse: warehouse._id,
      product: product._id,
      location: location._id,
    },
    {
      minQuantity: Number(payload.minQuantity),
      maxQuantity: Number(payload.maxQuantity),
      isActive: payload.isActive !== false,
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  )
    .populate('warehouse', 'code name')
    .populate('product', 'sku name trackingType')
    .populate('location', 'code path type purpose');

  return rule;
};

/**
 * Lists all active replenishment rules for a warehouse.
 *
 * @param {object} [filters={}] - Query filters.
 * @returns {Promise<Array<object>>} Configured rules.
 */
export const listReplenishmentRules = async (filters = {}) => {
  const query = {};
  if (filters.warehouse) {
    query.warehouse = filters.warehouse;
  }
  if (filters.product) {
    query.product = filters.product;
  }
  if (typeof filters.isActive === 'boolean') {
    query.isActive = filters.isActive;
  }

  return ReplenishmentRule.find(query)
    .populate('warehouse', 'code name')
    .populate('product', 'sku name trackingType')
    .populate('location', 'code path type purpose')
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * Evaluates replenishment needs across picking bins in a warehouse,
 * detecting deficits and identifying bulk reserve bins with available stock.
 *
 * @param {string} warehouseId - Warehouse identifier.
 * @returns {Promise<Array<object>>} Replenishment suggestions / task recommendations.
 */
export const evaluateReplenishmentNeeds = async (warehouseId) => {
  const rules = await ReplenishmentRule.find({
    warehouse: warehouseId,
    isActive: true,
  })
    .populate('warehouse', 'code name')
    .populate('product', 'sku name trackingType')
    .populate('location', 'code path type purpose')
    .lean();

  const recommendations = [];

  for (const rule of rules) {
    // Current balance at the forward pick face bin
    const currentBalance = await StockBalance.findOne({
      warehouse: warehouseId,
      product: rule.product._id,
      location: rule.location._id,
    }).lean();

    const currentOnHand = currentBalance ? currentBalance.onHand : 0;
    const currentAvailable = currentBalance
      ? Math.max(0, (currentBalance.onHand || 0) - (currentBalance.reserved || 0))
      : 0;

    if (currentOnHand < rule.minQuantity) {
      const deficit = rule.maxQuantity - currentOnHand;

      // Find available reserve stock in other storage bins in this warehouse
      const rawReserveBalances = await StockBalance.find({
        warehouse: warehouseId,
        product: rule.product._id,
        location: { $ne: rule.location._id },
        $expr: { $gt: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
      })
        .populate('location', 'code path type purpose')
        .populate('batch', 'batchNumber expiresOn')
        .sort({ onHand: -1 })
        .lean();

      const reserveBins = rawReserveBalances.map((rb) => ({
        location: rb.location,
        batch: rb.batch,
        availableQty: Math.max(0, (rb.onHand || 0) - (rb.reserved || 0)),
        onHandQty: rb.onHand,
      }));

      recommendations.push({
        ruleId: rule._id,
        warehouse: rule.warehouse,
        product: rule.product,
        pickBin: rule.location,
        minQuantity: rule.minQuantity,
        maxQuantity: rule.maxQuantity,
        currentOnHand,
        currentAvailable,
        deficitQuantity: deficit,
        status: currentOnHand === 0 ? 'CRITICAL_STOCKOUT' : 'BELOW_MINIMUM',
        reserveBins,
        totalReserveAvailable: reserveBins.reduce((sum, rb) => sum + rb.availableQty, 0),
      });
    }
  }

  return recommendations;
};
