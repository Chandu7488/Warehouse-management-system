/**
 * StockPilot WMS - Purchase Order Domain Service.
 *
 * Implements purchase order lifecycle management, pricing computations,
 * supplier validation, and status transitions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { PurchaseOrder, PO_STATUSES } from './purchaseOrder.model.js';
import { Supplier } from '../suppliers/supplier.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Product } from '../products/product.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Generates an auto-incrementing sequential purchase order number.
 *
 * @returns {Promise<string>} Sequential PO number.
 */
const generatePoNumber = async () => {
  const count = await PurchaseOrder.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  return `PO-${year}-${sequence}`;
};

/**
 * Creates a new draft purchase order.
 *
 * @param {object} payload - PO creation data.
 * @param {object} actor - Current authenticated user.
 * @returns {Promise<object>} Created purchase order.
 */
export const createPurchaseOrder = async (payload, actor) => {
  const supplier = await Supplier.findById(payload.supplier);
  if (!supplier || !supplier.isActive) {
    throw ApiError.unprocessable('Supplier not found or inactive');
  }

  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.unprocessable('Warehouse not found or inactive');
  }

  const productIds = payload.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  if (products.length !== productIds.length) {
    throw ApiError.unprocessable('One or more products not found in catalog');
  }

  let subtotalMinor = 0;
  const items = payload.items.map((item) => {
    const totalPriceMinor = Math.round(item.orderedQty * item.unitPriceMinor);
    subtotalMinor += totalPriceMinor;
    return {
      product: item.product,
      orderedQty: item.orderedQty,
      receivedQty: 0,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor,
    };
  });

  let poNumber = await generatePoNumber();
  let existing = await PurchaseOrder.findOne({ poNumber });
  while (existing) {
    poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    existing = await PurchaseOrder.findOne({ poNumber });
  }

  const purchaseOrder = await PurchaseOrder.create({
    poNumber,
    supplier: supplier._id,
    warehouse: warehouse._id,
    status: PO_STATUSES.DRAFT,
    expectedDeliveryDate: payload.expectedDeliveryDate ? new Date(payload.expectedDeliveryDate) : null,
    items,
    subtotalMinor,
    taxMinor: 0,
    totalMinor: subtotalMinor,
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return purchaseOrder.populate([
    { path: 'supplier', select: 'name code email' },
    { path: 'warehouse', select: 'name code' },
    { path: 'items.product', select: 'sku name unit trackingType costPriceMinor' },
    { path: 'createdBy', select: 'firstName lastName email' },
  ]);
};

/**
 * Lists purchase orders with filtering and pagination.
 *
 * @param {object} criteria - Search and filter criteria.
 * @returns {Promise<object>} Paginated list of purchase orders.
 */
export const listPurchaseOrders = async (criteria = {}) => {
  const { warehouse, supplier, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (supplier) {
    filter.supplier = supplier;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.poNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    PurchaseOrder.find(filter)
      .populate('supplier', 'name code email')
      .populate('warehouse', 'name code')
      .populate('items.product', 'sku name unit trackingType costPriceMinor')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    PurchaseOrder.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single purchase order by identifier.
 *
 * @param {string} id - PO identifier.
 * @returns {Promise<object>} Purchase order document.
 */
export const getPurchaseOrderById = async (id) => {
  const po = await PurchaseOrder.findById(id)
    .populate('supplier', 'name code email address phone')
    .populate('warehouse', 'name code address')
    .populate('items.product', 'sku name barcode trackingType unit costPriceMinor')
    .populate('confirmedBy', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  if (!po) {
    throw ApiError.notFound('Purchase order not found');
  }
  return po;
};

/**
 * Updates an existing draft purchase order.
 *
 * @param {string} id - PO identifier.
 * @param {object} payload - Updated fields.
 * @returns {Promise<object>} Updated purchase order.
 */
export const updatePurchaseOrder = async (id, payload) => {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found');
  }

  if (po.status !== PO_STATUSES.DRAFT) {
    throw ApiError.badRequest(`Cannot modify purchase order in status ${po.status}`);
  }

  if (payload.supplier) {
    const supplier = await Supplier.findById(payload.supplier);
    if (!supplier || !supplier.isActive) {
      throw ApiError.unprocessable('Supplier not found or inactive');
    }
    po.supplier = supplier._id;
  }

  if (payload.warehouse) {
    const warehouse = await Warehouse.findById(payload.warehouse);
    if (!warehouse || !warehouse.isActive) {
      throw ApiError.unprocessable('Warehouse not found or inactive');
    }
    po.warehouse = warehouse._id;
  }

  if (payload.expectedDeliveryDate !== undefined) {
    po.expectedDeliveryDate = payload.expectedDeliveryDate
      ? new Date(payload.expectedDeliveryDate)
      : null;
  }

  if (payload.notes !== undefined) {
    po.notes = payload.notes;
  }

  if (payload.items && payload.items.length > 0) {
    const productIds = payload.items.map((i) => i.product);
    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      throw ApiError.unprocessable('One or more products not found in catalog');
    }

    let subtotalMinor = 0;
    po.items = payload.items.map((item) => {
      const totalPriceMinor = Math.round(item.orderedQty * item.unitPriceMinor);
      subtotalMinor += totalPriceMinor;
      return {
        product: item.product,
        orderedQty: item.orderedQty,
        receivedQty: 0,
        unitPriceMinor: item.unitPriceMinor,
        totalPriceMinor,
      };
    });
    po.subtotalMinor = subtotalMinor;
    po.totalMinor = subtotalMinor;
  }

  await po.save();
  return getPurchaseOrderById(id);
};

/**
 * Confirms a draft purchase order.
 *
 * @param {string} id - PO identifier.
 * @param {object} actor - Authenticated user.
 * @returns {Promise<object>} Confirmed purchase order.
 */
export const confirmPurchaseOrder = async (id, actor) => {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found');
  }

  if (po.status !== PO_STATUSES.DRAFT) {
    throw ApiError.badRequest(`Only DRAFT orders can be confirmed (current: ${po.status})`);
  }

  po.status = PO_STATUSES.CONFIRMED;
  po.confirmedAt = new Date();
  po.confirmedBy = actor._id || actor.id;
  await po.save();

  return getPurchaseOrderById(id);
};

/**
 * Cancels a purchase order.
 *
 * @param {string} id - PO identifier.
 * @param {object} actor - Authenticated user.
 * @returns {Promise<object>} Cancelled purchase order.
 */
export const cancelPurchaseOrder = async (id, actor) => {
  const po = await PurchaseOrder.findById(id);
  if (!po) {
    throw ApiError.notFound('Purchase order not found');
  }

  if (po.status === PO_STATUSES.COMPLETED || po.status === PO_STATUSES.PARTIALLY_RECEIVED) {
    throw ApiError.badRequest(`Cannot cancel an order that has already received inventory (${po.status})`);
  }

  po.status = PO_STATUSES.CANCELLED;
  po.cancelledAt = new Date();
  po.cancelledBy = actor._id || actor.id;
  await po.save();

  return getPurchaseOrderById(id);
};
