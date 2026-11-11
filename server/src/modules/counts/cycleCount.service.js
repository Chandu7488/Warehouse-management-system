/**
 * StockPilot WMS - Cycle Count & Physical Inventory Domain Service.
 *
 * Implements count session planning, snapshot freezing, blind counting,
 * discrepancy recalculation, and transactional stock ledger variance reconciliation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import {
  CycleCount,
  COUNT_TYPES,
  COUNT_STATUSES,
  COUNT_ITEM_STATUSES,
} from './cycleCount.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Product } from '../products/product.model.js';
import { StockBalance } from '../inventory/stockBalance.model.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

/**
 * Generates the next sequential cycle count identifier.
 *
 * @returns {Promise<string>} Next identifier e.g. CC-2026-0001.
 */
export const generateCountNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `CC-${currentYear}-`;

  const latest = await CycleCount.findOne({
    countNumber: { $regex: `^${prefix}` },
  })
    .sort({ countNumber: -1 })
    .lean();

  let nextSeq = 1;
  if (latest && latest.countNumber) {
    const parts = latest.countNumber.split('-');
    const seqPart = parseInt(parts[2], 10);
    if (!Number.isNaN(seqPart)) {
      nextSeq = seqPart + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

/**
 * Creates a planned cycle count session.
 *
 * @param {object} payload - Count parameters.
 * @param {object} actor - Operator creating plan.
 * @returns {Promise<object>} Created count document.
 */
export const createCycleCountPlan = async (payload, actor) => {
  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.badRequest('Target warehouse not found or inactive');
  }

  const countNumber = await generateCountNumber();

  const countDoc = await CycleCount.create({
    countNumber,
    type: payload.type || COUNT_TYPES.CYCLE_COUNT,
    warehouse: warehouse._id,
    status: COUNT_STATUSES.DRAFT,
    blindCount: typeof payload.blindCount === 'boolean' ? payload.blindCount : true,
    scope: {
      locations: payload.scope?.locations || [],
      categories: payload.scope?.categories || [],
      products: payload.scope?.products || [],
    },
    assignedTo: payload.assignedTo || null,
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return getCycleCountById(countDoc._id);
};

/**
 * Starts a count session by freezing snapshot on-hand balances across the target scope.
 *
 * @param {string} id - Cycle count ID.
 * @returns {Promise<object>} Started cycle count.
 */
export const startCycleCount = async (id) => {
  const countDoc = await CycleCount.findById(id);
  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  if (countDoc.status !== COUNT_STATUSES.DRAFT) {
    throw ApiError.badRequest(`Cannot start count in status ${countDoc.status}`);
  }

  const balanceQuery = { warehouse: countDoc.warehouse };

  if (countDoc.scope?.locations && countDoc.scope.locations.length > 0) {
    balanceQuery.location = { $in: countDoc.scope.locations };
  }

  let scopedProductIds = countDoc.scope?.products || [];
  if (countDoc.scope?.categories && countDoc.scope.categories.length > 0) {
    const categoryProducts = await Product.find({
      category: { $in: countDoc.scope.categories },
      isActive: true,
    }).distinct('_id');
    scopedProductIds = [...scopedProductIds, ...categoryProducts];
  }

  if (scopedProductIds.length > 0) {
    balanceQuery.product = { $in: scopedProductIds };
  }

  const activeBalances = await StockBalance.find(balanceQuery)
    .populate('product', 'sku name costPriceMinor')
    .populate('location', 'code path type purpose isActive')
    .lean();

  const items = [];
  for (const bal of activeBalances) {
    if (!bal.location || !bal.location.isActive) {
      continue;
    }
    const cost = bal.product?.costPriceMinor || 0;
    items.push({
      product: bal.product?._id || bal.product,
      location: bal.location?._id || bal.location,
      batch: bal.batch || null,
      snapshotQty: bal.onHand,
      countedQty: null,
      varianceQty: 0,
      unitCostMinor: cost,
      varianceValueMinor: 0,
      status: COUNT_ITEM_STATUSES.PENDING,
      notes: '',
    });
  }

  countDoc.items = items;
  countDoc.totalItems = items.length;
  countDoc.status = COUNT_STATUSES.IN_PROGRESS;
  countDoc.startedAt = new Date();

  await countDoc.save();

  return getCycleCountById(countDoc._id);
};

/**
 * Records physical count results entered by operators.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} payload - Items containing physical counts.
 * @returns {Promise<object>} Updated cycle count document.
 */
export const recordCountResults = async (id, payload) => {
  const countDoc = await CycleCount.findById(id);
  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  if (
    countDoc.status !== COUNT_STATUSES.IN_PROGRESS &&
    countDoc.status !== COUNT_STATUSES.COUNTED
  ) {
    throw ApiError.badRequest(`Cannot submit counts in status ${countDoc.status}`);
  }

  const countMap = new Map();
  for (const item of payload.items) {
    countMap.set(String(item.itemId), item);
  }

  let matched = 0;
  let withVariance = 0;
  let netVarianceValue = 0;

  for (const line of countDoc.items) {
    const submission = countMap.get(String(line._id));
    if (submission) {
      const physicalQty = Number(submission.countedQty);
      line.countedQty = physicalQty;
      line.varianceQty = physicalQty - line.snapshotQty;
      line.varianceValueMinor = Math.round(line.varianceQty * (line.unitCostMinor || 0));
      line.status = COUNT_ITEM_STATUSES.COUNTED;
      if (submission.notes) {
        line.notes = submission.notes.trim();
      }
    }

    if (line.countedQty !== null && line.countedQty !== undefined) {
      if (line.varianceQty === 0) {
        matched += 1;
      } else {
        withVariance += 1;
      }
      netVarianceValue += line.varianceValueMinor || 0;
    }
  }

  countDoc.matchedItems = matched;
  countDoc.varianceItems = withVariance;
  countDoc.netVarianceValueMinor = netVarianceValue;

  const allCounted = countDoc.items.every(
    (i) => i.countedQty !== null && i.countedQty !== undefined,
  );
  if (allCounted) {
    countDoc.status = COUNT_STATUSES.COUNTED;
    countDoc.countedAt = new Date();
  }

  await countDoc.save();

  return getCycleCountById(countDoc._id);
};

/**
 * Flags selected items for recount and moves session back to IN_PROGRESS.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} payload - Recount item IDs.
 * @returns {Promise<object>} Updated cycle count document.
 */
export const requestRecount = async (id, payload) => {
  const countDoc = await CycleCount.findById(id);
  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  if (countDoc.status !== COUNT_STATUSES.COUNTED) {
    throw ApiError.badRequest(`Cannot request recount on status ${countDoc.status}`);
  }

  const recountSet = new Set(payload.itemIds.map(String));

  for (const line of countDoc.items) {
    if (recountSet.has(String(line._id))) {
      line.status = COUNT_ITEM_STATUSES.RECOUNT_REQUESTED;
      line.countedQty = null;
      line.varianceQty = 0;
      line.varianceValueMinor = 0;
      if (payload.notes) {
        line.notes = payload.notes;
      }
    }
  }

  countDoc.status = COUNT_STATUSES.IN_PROGRESS;
  await countDoc.save();

  return getCycleCountById(countDoc._id);
};

/**
 * Reconciles cycle count discrepancies, transactionally posting ADJUSTMENT_GAIN
 * or ADJUSTMENT_LOSS into the stock ledger and updating stock balances.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} payload - Reconciliation notes.
 * @param {object} actor - Approving manager.
 * @returns {Promise<object>} Reconciled cycle count document.
 */
export const reconcileCycleCount = async (id, payload, actor) => {
  const countDoc = await CycleCount.findById(id);
  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  if (countDoc.status !== COUNT_STATUSES.COUNTED) {
    throw ApiError.badRequest(
      `Only count orders in COUNTED status can be reconciled (current: ${countDoc.status})`,
    );
  }

  const session = await mongoose.startSession();
  try {
    let reconciledDoc;
    await session.withTransaction(async () => {
      const activeCount = await CycleCount.findById(id).session(session);
      const movements = [];

      for (const line of activeCount.items) {
        if (line.countedQty === null || line.countedQty === undefined) {
          throw ApiError.badRequest(
            'Cannot reconcile while some lines remain uncounted',
          );
        }

        if (line.varianceQty === 0) {
          line.status = COUNT_ITEM_STATUSES.APPROVED;
          continue;
        }

        const isGain = line.varianceQty > 0;
        movements.push({
          movementType: isGain
            ? MOVEMENT_TYPES.ADJUSTMENT_GAIN
            : MOVEMENT_TYPES.ADJUSTMENT_LOSS,
          product: line.product,
          warehouse: activeCount.warehouse,
          location: line.location,
          batch: line.batch || null,
          quantity: line.varianceQty,
          consumesReservation: false,
          referenceType: 'CYCLE_COUNT',
          referenceId: activeCount._id.toString(),
          referenceNo: activeCount.countNumber,
          lineId: String(line._id),
          reason:
            line.notes ||
            `Cycle count ${activeCount.countNumber} ${isGain ? 'gain' : 'loss'} reconciliation`,
        });

        line.status = COUNT_ITEM_STATUSES.APPROVED;
      }

      if (movements.length > 0) {
        await postMovements({ movements, actor, session });
      }

      activeCount.status = COUNT_STATUSES.RECONCILED;
      activeCount.reconciledAt = new Date();
      activeCount.reconciledBy = actor._id || actor.id;
      if (payload.notes) {
        activeCount.notes = payload.notes.trim();
      }

      await activeCount.save({ session });
      reconciledDoc = activeCount;
    });

    return getCycleCountById(reconciledDoc._id);
  } finally {
    await session.endSession();
  }
};

/**
 * Aborts a cycle count session.
 *
 * @param {string} id - Cycle count ID.
 * @param {string} [reason=''] - Cancellation rationale.
 * @returns {Promise<object>} Cancelled document.
 */
export const cancelCycleCount = async (id, reason = '') => {
  const countDoc = await CycleCount.findById(id);
  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  if (countDoc.status === COUNT_STATUSES.RECONCILED) {
    throw ApiError.badRequest('Cannot cancel an already reconciled cycle count');
  }

  countDoc.status = COUNT_STATUSES.CANCELLED;
  if (reason) {
    countDoc.notes = reason.trim();
  }

  await countDoc.save();

  return getCycleCountById(countDoc._id);
};

/**
 * Retrieves a single cycle count order by identifier.
 *
 * @param {string} id - Cycle count ID.
 * @returns {Promise<object>} Populated document.
 */
export const getCycleCountById = async (id) => {
  const countDoc = await CycleCount.findById(id)
    .populate('warehouse', 'code name address')
    .populate('assignedTo', 'name email role')
    .populate('reconciledBy', 'name email')
    .populate('createdBy', 'name email')
    .populate('scope.locations', 'code path type purpose')
    .populate('scope.categories', 'name code')
    .populate('scope.products', 'sku name')
    .populate('items.product', 'sku name trackingType costPriceMinor salePriceMinor')
    .populate('items.location', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn');

  if (!countDoc) {
    throw ApiError.notFound('Cycle count order not found');
  }

  return countDoc;
};

/**
 * Lists paginated cycle counts with filtering and search.
 *
 * @param {object} [filters={}] - Query filters.
 * @param {object} [pagination={}] - Pagination metadata.
 * @returns {Promise<{items: Array<object>, meta: object}>} Paginated count orders.
 */
export const listCycleCounts = async (filters = {}, pagination = {}) => {
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
      { countNumber: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 20));
  const skip = getSkip(page, limit);

  const [items, total] = await Promise.all([
    CycleCount.find(query)
      .populate('warehouse', 'code name')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CycleCount.countDocuments(query),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page, limit, total }),
  };
};
