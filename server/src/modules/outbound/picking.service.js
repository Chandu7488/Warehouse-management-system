/**
 * StockPilot WMS - Wave / Pick List Domain Service.
 *
 * Implements pick wave creation, bin path optimization, pick task dispatching,
 * and operator confirmation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { PickList, PICK_STATUSES, PICK_ITEM_STATUSES } from './pickList.model.js';
import { SalesOrder, SO_STATUSES } from './salesOrder.model.js';
import { Location, LOCATION_PURPOSES } from '../locations/location.model.js';
import { allocateSalesOrder } from './allocation.service.js';
import { Serial, SERIAL_STATUSES } from '../inventory/serial.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Generates an auto-incrementing sequential pick list number.
 *
 * @returns {Promise<string>} Sequential pick number.
 */
const generatePickNumber = async () => {
  const count = await PickList.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  let pickNumber = `PICK-${year}-${sequence}`;
  let existing = await PickList.findOne({ pickNumber });
  while (existing) {
    pickNumber = `PICK-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    existing = await PickList.findOne({ pickNumber });
  }
  return pickNumber;
};

/**
 * Resolves the outbound packing staging location.
 *
 * @param {string} warehouseId - Warehouse identifier.
 * @param {string} [preferredId] - Explicit staging location ID.
 * @returns {Promise<object>} Active staging location.
 */
const resolveStagingLocation = async (warehouseId, preferredId) => {
  if (preferredId) {
    const loc = await Location.findById(preferredId);
    if (loc && loc.isActive && String(loc.warehouse) === String(warehouseId)) {
      return loc;
    }
  }

  const packingLoc = await Location.findOne({
    warehouse: warehouseId,
    purpose: LOCATION_PURPOSES.PACKING,
    isActive: true,
  });
  if (packingLoc) {
    return packingLoc;
  }

  const stagingLoc = await Location.findOne({
    warehouse: warehouseId,
    purpose: LOCATION_PURPOSES.STAGING,
    isActive: true,
  });
  if (stagingLoc) {
    return stagingLoc;
  }

  const fallback = await Location.findOne({ warehouse: warehouseId, isActive: true });
  if (!fallback) {
    throw ApiError.unprocessable('No active locations configured for warehouse');
  }
  return fallback;
};

/**
 * Creates a new wave / pick list for one or more sales orders.
 *
 * @param {object} payload - Creation parameters.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created PickList document.
 */
export const createPickList = async (payload, actor) => {
  const warehouseId = payload.warehouse;
  const orderIds = payload.salesOrderIds;

  const orders = await SalesOrder.find({
    _id: { $in: orderIds },
    warehouse: warehouseId,
  });

  if (orders.length !== orderIds.length) {
    throw ApiError.unprocessable('One or more sales orders not found in this warehouse');
  }

  const rawTasks = [];

  for (const order of orders) {
    if (order.status === SO_STATUSES.DRAFT) {
      throw ApiError.badRequest(`Order ${order.soNumber} is in DRAFT status and must be confirmed first`);
    }

    // Ensure hard allocation exists
    if (order.status === SO_STATUSES.CONFIRMED || order.items.some((i) => i.allocatedQty < i.orderedQty)) {
      await allocateSalesOrder(order._id);
      // Reload order with allocations
      const refreshedOrder = await SalesOrder.findById(order._id);
      order.items = refreshedOrder.items;
      order.status = refreshedOrder.status;
    }

    for (const item of order.items) {
      for (const alloc of item.allocations) {
        rawTasks.push({
          salesOrder: order._id,
          salesOrderItem: item._id,
          product: item.product,
          location: alloc.location,
          batch: alloc.batch || null,
          serials: alloc.serial ? [alloc.serial] : [],
          quantity: alloc.quantity,
          pickedQuantity: 0,
          status: PICK_ITEM_STATUSES.PENDING,
        });
      }
    }
  }

  if (rawTasks.length === 0) {
    throw ApiError.badRequest('No allocated items available to generate pick tasks');
  }

  // Populate locations to sort tasks along optimal warehouse walk path
  const locationIds = rawTasks.map((t) => t.location);
  const locations = await Location.find({ _id: { $in: locationIds } });
  const locationMap = new Map(locations.map((loc) => [loc._id.toString(), loc]));

  rawTasks.sort((a, b) => {
    const locA = locationMap.get(a.location.toString())?.path || '';
    const locB = locationMap.get(b.location.toString())?.path || '';
    return locA.localeCompare(locB);
  });

  const stagingLocation = await resolveStagingLocation(warehouseId, payload.stagingLocationId);
  const pickNumber = await generatePickNumber();

  const pickList = await PickList.create({
    pickNumber,
    warehouse: warehouseId,
    status: PICK_STATUSES.PENDING,
    assignedTo: payload.assignedTo || null,
    salesOrders: orderIds,
    items: rawTasks,
    stagingLocation: stagingLocation._id,
    createdBy: actor._id || actor.id,
  });

  // Transition orders to PICKING
  await SalesOrder.updateMany(
    { _id: { $in: orderIds } },
    { $set: { status: SO_STATUSES.PICKING } },
  );

  return pickList.populate([
    { path: 'warehouse', select: 'name code' },
    { path: 'assignedTo', select: 'firstName lastName email' },
    { path: 'stagingLocation', select: 'code path type purpose' },
    { path: 'items.product', select: 'sku name barcode trackingType unit' },
    { path: 'items.location', select: 'code path type purpose' },
    { path: 'items.batch', select: 'batchNumber expiresOn' },
  ]);
};

/**
 * Lists pick lists with pagination and status filtering.
 *
 * @param {object} criteria - Search and filter parameters.
 * @returns {Promise<object>} Paginated pick list collection.
 */
export const listPickLists = async (criteria = {}) => {
  const { warehouse, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.pickNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    PickList.find(filter)
      .populate('warehouse', 'name code')
      .populate('assignedTo', 'firstName lastName email')
      .populate('stagingLocation', 'code path')
      .populate('items.product', 'sku name barcode')
      .populate('items.location', 'code path')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    PickList.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single pick list document with populated relations.
 *
 * @param {string} id - Pick list identifier.
 * @returns {Promise<object>} Populated pick list.
 */
export const getPickListById = async (id) => {
  const pickList = await PickList.findById(id)
    .populate('warehouse', 'name code')
    .populate('assignedTo', 'firstName lastName email')
    .populate('stagingLocation', 'code path type purpose')
    .populate('salesOrders', 'soNumber status customer shippingAddress')
    .populate('items.product', 'sku name barcode trackingType unit')
    .populate('items.location', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn')
    .populate('items.serials', 'serialNumber status')
    .populate('createdBy', 'firstName lastName email');

  if (!pickList) {
    throw ApiError.notFound('Pick list not found');
  }

  return pickList;
};

/**
 * Commences picking on a pending pick list.
 *
 * @param {string} id - Pick list identifier.
 * @param {object} actor - Assigned operator.
 * @returns {Promise<object>} In-progress pick list.
 */
export const startPickList = async (id, actor) => {
  const pickList = await PickList.findById(id);
  if (!pickList) {
    throw ApiError.notFound('Pick list not found');
  }

  if (pickList.status === PICK_STATUSES.COMPLETED || pickList.status === PICK_STATUSES.CANCELLED) {
    throw ApiError.badRequest(`Cannot start pick list in ${pickList.status} status`);
  }

  pickList.status = PICK_STATUSES.IN_PROGRESS;
  pickList.assignedTo = actor._id || actor.id;
  if (!pickList.startedAt) {
    pickList.startedAt = new Date();
  }
  await pickList.save();

  return getPickListById(pickList._id);
};

/**
 * Confirms a single picked item line during pick execution.
 *
 * @param {string} pickListId - Pick list identifier.
 * @param {object} payload - Pick confirmation payload.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Updated pick list.
 */
export const confirmPickItem = async (pickListId, payload, actor) => {
  const pickList = await PickList.findById(pickListId);
  if (!pickList) {
    throw ApiError.notFound('Pick list not found');
  }

  if (pickList.status === PICK_STATUSES.COMPLETED) {
    throw ApiError.badRequest('Pick list is already fully completed');
  }

  const itemIndex = pickList.items.findIndex((i) => i._id.toString() === payload.itemId);
  if (itemIndex === -1) {
    throw ApiError.notFound('Pick item line not found');
  }

  const pickItem = pickList.items[itemIndex];
  const pickedQty = Number(payload.pickedQty);

  if (pickedQty <= 0) {
    throw ApiError.badRequest('Picked quantity must be greater than zero');
  }

  pickItem.pickedQuantity = pickedQty;
  pickItem.status =
    pickedQty >= pickItem.quantity ? PICK_ITEM_STATUSES.PICKED : PICK_ITEM_STATUSES.SHORTAGE;

  // Handle serial numbers if tracked
  if (payload.serialNumbers && payload.serialNumbers.length > 0) {
    const serialDocs = await Serial.find({
      serialNumber: { $in: payload.serialNumbers },
      product: pickItem.product,
    });
    pickItem.serials = serialDocs.map((s) => s._id);

    // Reserve serials
    await Serial.updateMany(
      { _id: { $in: pickItem.serials } },
      { $set: { status: SERIAL_STATUSES.RESERVED } },
    );
  }

  // Update SalesOrder picked quantity
  const salesOrder = await SalesOrder.findById(pickItem.salesOrder);
  if (salesOrder) {
    const soLine = salesOrder.items.id(pickItem.salesOrderItem);
    if (soLine) {
      soLine.pickedQty = (soLine.pickedQty || 0) + pickedQty;
      await salesOrder.save();
    }
  }

  // If pick list was PENDING, auto-advance to IN_PROGRESS
  if (pickList.status === PICK_STATUSES.PENDING) {
    pickList.status = PICK_STATUSES.IN_PROGRESS;
    pickList.assignedTo = actor._id || actor.id;
    pickList.startedAt = new Date();
  }

  // Check if all items in the pick list are resolved
  const allResolved = pickList.items.every(
    (i) => i.status === PICK_ITEM_STATUSES.PICKED || i.status === PICK_ITEM_STATUSES.SHORTAGE,
  );

  if (allResolved) {
    pickList.status = PICK_STATUSES.COMPLETED;
    pickList.completedAt = new Date();

    // Update linked sales orders to PACKED / ready for shipping
    await SalesOrder.updateMany(
      { _id: { $in: pickList.salesOrders } },
      { $set: { status: SO_STATUSES.PACKED } },
    );
  }

  await pickList.save();
  return getPickListById(pickList._id);
};

/**
 * Cancels a pick list and reverts sales orders to ALLOCATED status.
 *
 * @param {string} id - Pick list identifier.
 * @returns {Promise<object>} Cancelled pick list.
 */
export const cancelPickList = async (id) => {
  const pickList = await PickList.findById(id);
  if (!pickList) {
    throw ApiError.notFound('Pick list not found');
  }

  if (pickList.status === PICK_STATUSES.COMPLETED) {
    throw ApiError.badRequest('Cannot cancel a completed pick list');
  }

  pickList.status = PICK_STATUSES.CANCELLED;
  await pickList.save();

  await SalesOrder.updateMany(
    { _id: { $in: pickList.salesOrders } },
    { $set: { status: SO_STATUSES.ALLOCATED } },
  );

  return getPickListById(pickList._id);
};
