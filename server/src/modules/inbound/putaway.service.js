/**
 * StockPilot WMS - Directed Putaway Task Domain Service.
 *
 * Implements intelligent bin suggestion algorithms, task dispatching,
 * and transactional execution of stock transfers from receiving docks to storage bins.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { PutawayTask, PUTAWAY_STATUSES } from './putawayTask.model.js';
import { Location, LOCATION_PURPOSES, LOCATION_TYPES } from '../locations/location.model.js';
import { StockBalance } from '../inventory/stockBalance.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Suggests the optimal storage bin for putaway based on consolidation and availability.
 *
 * @param {object} params - Suggestion parameters.
 * @param {string} params.warehouseId - Warehouse identifier.
 * @param {string} params.productId - Product identifier.
 * @param {string} [params.batchId=null] - Batch identifier if tracked.
 * @returns {Promise<object>} Recommended location document.
 */
export const suggestPutawayLocation = async ({ warehouseId, productId, batchId = null }) => {
  if (batchId) {
    const existingSameLotBalance = await StockBalance.findOne({
      warehouse: warehouseId,
      product: productId,
      batch: batchId,
      onHand: { $gt: 0 },
    }).populate('location');

    if (
      existingSameLotBalance?.location?.isActive &&
      (existingSameLotBalance.location.purpose === LOCATION_PURPOSES.STORAGE ||
        existingSameLotBalance.location.purpose === LOCATION_PURPOSES.PICKING)
    ) {
      return existingSameLotBalance.location;
    }
  }

  const existingProductBalance = await StockBalance.findOne({
    warehouse: warehouseId,
    product: productId,
    onHand: { $gt: 0 },
  }).populate('location');

  if (
    existingProductBalance?.location?.isActive &&
    (existingProductBalance.location.purpose === LOCATION_PURPOSES.STORAGE ||
      existingProductBalance.location.purpose === LOCATION_PURPOSES.PICKING)
  ) {
    return existingProductBalance.location;
  }

  const storageBins = await Location.find({
    warehouse: warehouseId,
    purpose: LOCATION_PURPOSES.STORAGE,
    type: LOCATION_TYPES.BIN,
    isActive: true,
  }).sort({ path: 1 });

  if (storageBins.length > 0) {
    const binIds = storageBins.map((b) => b._id);
    const activeBalances = await StockBalance.find({
      warehouse: warehouseId,
      location: { $in: binIds },
      onHand: { $gt: 0 },
    });
    const occupiedLocationIds = new Set(activeBalances.map((b) => b.location.toString()));

    const emptyBin = storageBins.find((b) => !occupiedLocationIds.has(b._id.toString()));
    if (emptyBin) {
      return emptyBin;
    }
    return storageBins[0];
  }

  const anyStorageLocation = await Location.findOne({
    warehouse: warehouseId,
    purpose: LOCATION_PURPOSES.STORAGE,
    isActive: true,
  }).sort({ path: 1 });

  if (anyStorageLocation) {
    return anyStorageLocation;
  }

  const fallback = await Location.findOne({
    warehouse: warehouseId,
    isActive: true,
  });

  if (!fallback) {
    throw ApiError.notFound('No active storage locations available in this warehouse');
  }

  return fallback;
};

/**
 * Lists putaway tasks with filtering and pagination.
 *
 * @param {object} criteria - Search and filter parameters.
 * @returns {Promise<object>} Paginated putaway task list.
 */
export const listPutawayTasks = async (criteria = {}) => {
  const { warehouse, product, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (product) {
    filter.product = product;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.taskNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    PutawayTask.find(filter)
      .populate('product', 'sku name barcode unit trackingType')
      .populate('warehouse', 'name code')
      .populate('sourceLocation', 'code path type purpose')
      .populate('suggestedLocation', 'code path type purpose')
      .populate('destinationLocation', 'code path type purpose')
      .populate('batch', 'batchNumber expiresOn')
      .populate('assignedTo', 'firstName lastName email')
      .populate('completedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    PutawayTask.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single putaway task by identifier.
 *
 * @param {string} id - Task identifier.
 * @returns {Promise<object>} Task document.
 */
export const getPutawayTaskById = async (id) => {
  const task = await PutawayTask.findById(id)
    .populate('product', 'sku name barcode unit trackingType')
    .populate('warehouse', 'name code')
    .populate('sourceLocation', 'code path type purpose')
    .populate('suggestedLocation', 'code path type purpose')
    .populate('destinationLocation', 'code path type purpose')
    .populate('batch', 'batchNumber expiresOn')
    .populate('serials', 'serialNumber status')
    .populate('assignedTo', 'firstName lastName email')
    .populate('completedBy', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  if (!task) {
    throw ApiError.notFound('Putaway task not found');
  }
  return task;
};

/**
 * Completes a putaway task and executes the atomic stock transfer.
 *
 * @param {object} params - Completion parameters.
 * @param {string} params.taskId - Putaway task identifier.
 * @param {string} params.destinationLocationId - Confirmed target location.
 * @param {string} [params.notes] - Operator completion notes.
 * @param {object} params.actor - Authenticated operator.
 * @returns {Promise<object>} Completed putaway task.
 */
export const completePutawayTask = async ({ taskId, destinationLocationId, notes, actor }) => {
  const task = await PutawayTask.findById(taskId);
  if (!task) {
    throw ApiError.notFound('Putaway task not found');
  }

  if (task.status === PUTAWAY_STATUSES.COMPLETED) {
    throw ApiError.conflict('Putaway task has already been completed');
  }
  if (task.status === PUTAWAY_STATUSES.CANCELLED) {
    throw ApiError.badRequest('Cannot complete a cancelled putaway task');
  }

  const destinationLocation = await Location.findById(destinationLocationId);
  if (!destinationLocation || !destinationLocation.isActive) {
    throw ApiError.unprocessable('Destination storage location not found or inactive');
  }
  if (String(destinationLocation.warehouse) !== String(task.warehouse)) {
    throw ApiError.badRequest('Destination location must be in the same warehouse');
  }

  const sourceLocation = await Location.findById(task.sourceLocation);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const deductionMovement = {
        movementType: MOVEMENT_TYPES.PUTAWAY,
        product: task.product,
        warehouse: task.warehouse,
        location: task.sourceLocation,
        batch: task.batch,
        quantity: -task.quantity,
        referenceType: 'PUTAWAY_TASK',
        referenceId: task._id.toString(),
        referenceNo: task.taskNumber,
        lineId: new mongoose.Types.ObjectId(),
        reason: `Putaway transfer from ${sourceLocation?.path || 'Receiving'} to ${destinationLocation.path}`,
      };

      const additionMovement = {
        movementType: MOVEMENT_TYPES.PUTAWAY,
        product: task.product,
        warehouse: task.warehouse,
        location: destinationLocation._id,
        batch: task.batch,
        quantity: task.quantity,
        referenceType: 'PUTAWAY_TASK',
        referenceId: task._id.toString(),
        referenceNo: task.taskNumber,
        lineId: new mongoose.Types.ObjectId(),
        reason: `Putaway received from ${sourceLocation?.path || 'Receiving'} into ${destinationLocation.path}`,
      };

      await postMovements({
        movements: [deductionMovement, additionMovement],
        session,
        actor,
      });

      task.destinationLocation = destinationLocation._id;
      task.status = PUTAWAY_STATUSES.COMPLETED;
      task.completedAt = new Date();
      task.completedBy = actor._id || actor.id;
      if (notes) {
        task.notes = notes;
      }
      await task.save({ session });
    });

    return getPutawayTaskById(taskId);
  } finally {
    await session.endSession();
  }
};

/**
 * Cancels a pending putaway task.
 *
 * @param {object} params - Cancellation parameters.
 * @param {string} params.taskId - Putaway task identifier.
 * @param {object} params.actor - Authenticated user.
 * @returns {Promise<object>} Cancelled task.
 */
export const cancelPutawayTask = async ({ taskId, actor }) => {
  const task = await PutawayTask.findById(taskId);
  if (!task) {
    throw ApiError.notFound('Putaway task not found');
  }

  if (task.status === PUTAWAY_STATUSES.COMPLETED) {
    throw ApiError.badRequest('Cannot cancel a completed putaway task');
  }

  task.status = PUTAWAY_STATUSES.CANCELLED;
  task.cancelledAt = new Date();
  task.cancelledBy = actor._id || actor.id;
  await task.save();

  return getPutawayTaskById(taskId);
};
