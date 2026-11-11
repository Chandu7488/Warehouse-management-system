/**
 * StockPilot WMS - Stock Adjustment & Write-off Domain Service.
 *
 * Implements direct inventory write-offs, manual adjustments,
 * discrepancy justifications, and transactional ledger adjustments.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import {
  StockAdjustment,
  ADJUSTMENT_TYPES,
  ADJUSTMENT_STATUSES,
} from './stockAdjustment.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Product } from '../products/product.model.js';
import { Location } from '../locations/location.model.js';
import { StockBalance } from '../inventory/stockBalance.model.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

/**
 * Generates the next sequential stock adjustment identifier.
 *
 * @returns {Promise<string>} Next identifier e.g. ADJ-2026-0001.
 */
export const generateAdjustmentNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `ADJ-${currentYear}-`;

  const latest = await StockAdjustment.findOne({
    adjustmentNumber: { $regex: `^${prefix}` },
  })
    .sort({ adjustmentNumber: -1 })
    .lean();

  let nextSeq = 1;
  if (latest && latest.adjustmentNumber) {
    const parts = latest.adjustmentNumber.split('-');
    const seqPart = parseInt(parts[2], 10);
    if (!Number.isNaN(seqPart)) {
      nextSeq = seqPart + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Creates a direct stock adjustment or write-off proposal.
 *
 * @param {object} payload - Adjustment parameters.
 * @param {object} actor - Submitting operator.
 * @returns {Promise<object>} Created stock adjustment document.
 */
export const createAdjustment = async (payload, actor) => {
  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.badRequest('Target warehouse not found or inactive');
  }

  const validatedItems = [];
  let netQty = 0;
  let netVal = 0;

  for (const it of payload.items) {
    const product = await Product.findById(it.product);
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product ${it.product} not found or inactive`);
    }

    const location = await Location.findById(it.location);
    if (!location || !location.isActive || String(location.warehouse) !== String(warehouse._id)) {
      throw ApiError.badRequest('Location must be active and belong to target warehouse');
    }

    const qty = Number(it.quantity);
    if (typeof qty !== 'number' || Number.isNaN(qty) || qty === 0) {
      throw ApiError.badRequest('Adjustment quantity cannot be zero');
    }

    if (qty < 0) {
      const balance = await StockBalance.findOne({
        warehouse: warehouse._id,
        location: location._id,
        product: product._id,
        ...(it.batch ? { batch: it.batch } : {}),
      });

      const currentOnHand = balance?.onHand || 0;
      if (currentOnHand + qty < 0) {
        throw ApiError.badRequest(
          `Cannot deduct ${Math.abs(qty)} units of ${product.sku} at ${location.code}; current on-hand is only ${currentOnHand}`,
        );
      }
    }

    const costMinor = product.costPriceMinor || 0;
    const itemValMinor = Math.round(qty * costMinor);

    validatedItems.push({
      product: product._id,
      location: location._id,
      batch: it.batch || null,
      quantity: qty,
      unitCostMinor: costMinor,
      totalValueMinor: itemValMinor,
      reason: it.reason.trim(),
    });

    netQty += qty;
    netVal += itemValMinor;
  }

  const adjustmentNumber = await generateAdjustmentNumber();

  const adj = await StockAdjustment.create({
    adjustmentNumber,
    warehouse: warehouse._id,
    type: payload.type || ADJUSTMENT_TYPES.MANUAL_ADJUSTMENT,
    status: ADJUSTMENT_STATUSES.DRAFT,
    reason: payload.reason.trim(),
    items: validatedItems,
    totalItems: validatedItems.length,
    netQuantity: netQty,
    netValueMinor: netVal,
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return getAdjustmentById(adj._id);
};

/**
 * Approves a stock adjustment, transactionally posting ledger movements.
 *
 * @param {string} id - Stock adjustment ID.
 * @param {object} payload - Approval notes.
 * @param {object} actor - Approving manager.
 * @returns {Promise<object>} Approved stock adjustment document.
 */
export const approveAdjustment = async (id, payload, actor) => {
  const adj = await StockAdjustment.findById(id);
  if (!adj) {
    throw ApiError.notFound('Stock adjustment not found');
  }

  if (adj.status !== ADJUSTMENT_STATUSES.DRAFT) {
    throw ApiError.badRequest(`Cannot approve adjustment in status ${adj.status}`);
  }

  const session = await mongoose.startSession();
  try {
    let approvedDoc;
    await session.withTransaction(async () => {
      const activeAdj = await StockAdjustment.findById(id).session(session);
      const movements = [];

      for (const line of activeAdj.items) {
        const isGain = line.quantity > 0;
        let movementType;
        if (isGain) {
          movementType = MOVEMENT_TYPES.ADJUSTMENT_GAIN;
        } else if (
          activeAdj.type === ADJUSTMENT_TYPES.WRITE_OFF ||
          activeAdj.type === ADJUSTMENT_TYPES.DAMAGED_SCRAP
        ) {
          movementType = MOVEMENT_TYPES.WRITE_OFF;
        } else {
          movementType = MOVEMENT_TYPES.ADJUSTMENT_LOSS;
        }

        movements.push({
          movementType,
          product: line.product,
          warehouse: activeAdj.warehouse,
          location: line.location,
          batch: line.batch || null,
          quantity: line.quantity,
          consumesReservation: false,
          referenceType: 'STOCK_ADJUSTMENT',
          referenceId: activeAdj._id.toString(),
          referenceNo: activeAdj.adjustmentNumber,
          lineId: String(line._id),
          reason: line.reason || activeAdj.reason,
        });
      }

      await postMovements({ movements, actor, session });

      activeAdj.status = ADJUSTMENT_STATUSES.APPROVED;
      activeAdj.approvedAt = new Date();
      activeAdj.approvedBy = actor._id || actor.id;
      if (payload.notes) {
        activeAdj.notes = payload.notes.trim();
      }

      await activeAdj.save({ session });
      approvedDoc = activeAdj;
    });

    return getAdjustmentById(approvedDoc._id);
  } finally {
    await session.endSession();
  }
};

/**
 * Rejects a proposed stock adjustment.
 *
 * @param {string} id - Stock adjustment ID.
 * @param {string} [reason=''] - Rejection rationale.
 * @param {object} actor - Rejecting manager.
 * @returns {Promise<object>} Rejected document.
 */
export const rejectAdjustment = async (id, reason = '', actor) => {
  const adj = await StockAdjustment.findById(id);
  if (!adj) {
    throw ApiError.notFound('Stock adjustment not found');
  }

  if (adj.status !== ADJUSTMENT_STATUSES.DRAFT) {
    throw ApiError.badRequest(`Cannot reject adjustment in status ${adj.status}`);
  }

  adj.status = ADJUSTMENT_STATUSES.REJECTED;
  adj.approvedBy = actor._id || actor.id;
  adj.approvedAt = new Date();
  if (reason) {
    adj.notes = reason.trim();
  }

  await adj.save();

  return getAdjustmentById(adj._id);
};

/**
 * Retrieves a single stock adjustment by ID.
 *
 * @param {string} id - Stock adjustment ID.
 * @returns {Promise<object>} Populated document.
 */
export const getAdjustmentById = async (id) => {
  const adj = await StockAdjustment.findById(id)
    .populate('warehouse', 'code name address')
    .populate('approvedBy', 'name email')
    .populate('createdBy', 'name email')
    .populate('items.product', 'sku name trackingType costPriceMinor salePriceMinor')
    .populate('items.location', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn');

  if (!adj) {
    throw ApiError.notFound('Stock adjustment not found');
  }

  return adj;
};

/**
 * Lists paginated stock adjustments with filtering and search.
 *
 * @param {object} [filters={}] - Query filters.
 * @param {object} [pagination={}] - Pagination parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Paginated stock adjustments.
 */
export const listAdjustments = async (filters = {}, pagination = {}) => {
  const query = {};

  if (filters.warehouse) {
    query.warehouse = filters.warehouse;
  }
  if (filters.type) {
    query.type = filters.type;
  }
  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.search) {
    const term = filters.search.trim();
    query.$or = [
      { adjustmentNumber: { $regex: term, $options: 'i' } },
      { reason: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 20));
  const skip = getSkip(page, limit);

  const [items, total] = await Promise.all([
    StockAdjustment.find(query)
      .populate('warehouse', 'code name')
      .populate('approvedBy', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockAdjustment.countDocuments(query),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page, limit, total }),
  };
};
