/**
 * StockPilot WMS - Sales Order Domain Service.
 *
 * Implements customer procurement workflows, pricing calculations,
 * and order lifecycle operations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { SalesOrder, SO_STATUSES } from './salesOrder.model.js';
import { Customer } from '../customers/customer.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Product } from '../products/product.model.js';
import { allocateSalesOrder, deallocateSalesOrder } from './allocation.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Generates a sequential sales order number.
 *
 * @returns {Promise<string>} Sequential SO number.
 */
const generateSoNumber = async () => {
  const count = await SalesOrder.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  let soNumber = `SO-${year}-${sequence}`;
  let existing = await SalesOrder.findOne({ soNumber });
  while (existing) {
    soNumber = `SO-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    existing = await SalesOrder.findOne({ soNumber });
  }
  return soNumber;
};

/**
 * Creates a new draft sales order.
 *
 * @param {object} payload - Sales order creation payload.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created sales order document.
 */
export const createSalesOrder = async (payload, actor) => {
  const customer = await Customer.findById(payload.customer);
  if (!customer || !customer.isActive) {
    throw ApiError.unprocessable('Customer not found or inactive');
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
      allocatedQty: 0,
      pickedQty: 0,
      packedQty: 0,
      shippedQty: 0,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor,
      allocations: [],
    };
  });

  const taxMinor = payload.taxMinor || 0;
  const shippingMinor = payload.shippingMinor || 0;
  const totalMinor = subtotalMinor + taxMinor + shippingMinor;
  const soNumber = await generateSoNumber();

  const shippingAddress = payload.shippingAddress || {
    street: customer.address?.street || '',
    city: customer.address?.city || '',
    state: customer.address?.state || '',
    postalCode: customer.address?.postalCode || '',
    country: customer.address?.country || 'US',
  };

  const salesOrder = await SalesOrder.create({
    soNumber,
    customer: customer._id,
    warehouse: warehouse._id,
    status: SO_STATUSES.DRAFT,
    requestedDeliveryDate: payload.requestedDeliveryDate
      ? new Date(payload.requestedDeliveryDate)
      : null,
    items,
    shippingAddress,
    subtotalMinor,
    taxMinor,
    shippingMinor,
    totalMinor,
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return salesOrder.populate([
    { path: 'customer', select: 'name code email companyName phone' },
    { path: 'warehouse', select: 'name code' },
    { path: 'items.product', select: 'sku name unit trackingType salePriceMinor costPriceMinor' },
    { path: 'createdBy', select: 'firstName lastName email' },
  ]);
};

/**
 * Lists sales orders with filtering and pagination.
 *
 * @param {object} criteria - Search and filter parameters.
 * @returns {Promise<object>} Paginated sales order list.
 */
export const listSalesOrders = async (criteria = {}) => {
  const { warehouse, customer, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (customer) {
    filter.customer = customer;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.soNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    SalesOrder.find(filter)
      .populate('customer', 'name code email companyName')
      .populate('warehouse', 'name code')
      .populate('items.product', 'sku name unit trackingType')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    SalesOrder.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single sales order by identifier.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Populated sales order document.
 */
export const getSalesOrderById = async (id) => {
  const salesOrder = await SalesOrder.findById(id)
    .populate('customer', 'name code email companyName phone')
    .populate('warehouse', 'name code')
    .populate('items.product', 'sku name unit trackingType salePriceMinor costPriceMinor')
    .populate('items.allocations.location', 'code path purpose type')
    .populate('items.allocations.batch', 'batchNumber expiresOn')
    .populate('createdBy', 'firstName lastName email');

  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  return salesOrder;
};

/**
 * Updates a draft sales order.
 *
 * @param {string} id - Sales order identifier.
 * @param {object} payload - Fields to update.
 * @returns {Promise<object>} Updated sales order.
 */
export const updateSalesOrder = async (id, payload) => {
  const salesOrder = await SalesOrder.findById(id);
  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  if (salesOrder.status !== SO_STATUSES.DRAFT) {
    throw ApiError.badRequest('Only orders in DRAFT status can be modified');
  }

  if (payload.customer) {
    salesOrder.customer = payload.customer;
  }
  if (payload.warehouse) {
    salesOrder.warehouse = payload.warehouse;
  }
  if (payload.notes !== undefined) {
    salesOrder.notes = payload.notes;
  }
  if (payload.requestedDeliveryDate !== undefined) {
    salesOrder.requestedDeliveryDate = payload.requestedDeliveryDate
      ? new Date(payload.requestedDeliveryDate)
      : null;
  }
  if (payload.shippingAddress) {
    salesOrder.shippingAddress = { ...salesOrder.shippingAddress, ...payload.shippingAddress };
  }

  if (payload.items && payload.items.length > 0) {
    let subtotalMinor = 0;
    salesOrder.items = payload.items.map((item) => {
      const totalPriceMinor = Math.round(item.orderedQty * item.unitPriceMinor);
      subtotalMinor += totalPriceMinor;
      return {
        product: item.product,
        orderedQty: item.orderedQty,
        allocatedQty: 0,
        pickedQty: 0,
        packedQty: 0,
        shippedQty: 0,
        unitPriceMinor: item.unitPriceMinor,
        totalPriceMinor,
        allocations: [],
      };
    });
    salesOrder.subtotalMinor = subtotalMinor;
    salesOrder.totalMinor =
      subtotalMinor + (salesOrder.taxMinor || 0) + (salesOrder.shippingMinor || 0);
  }

  await salesOrder.save();
  return getSalesOrderById(salesOrder._id);
};

/**
 * Confirms a draft sales order and automatically attempts inventory allocation.
 *
 * @param {string} id - Sales order identifier.
 * @param {object} _actor - Authenticated user.
 * @returns {Promise<object>} Confirmed (and allocated) sales order.
 */
export const confirmSalesOrder = async (id, _actor) => {
  const salesOrder = await SalesOrder.findById(id);
  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  if (salesOrder.status !== SO_STATUSES.DRAFT) {
    throw ApiError.badRequest('Only DRAFT orders can be confirmed');
  }

  salesOrder.status = SO_STATUSES.CONFIRMED;
  await salesOrder.save();

  try {
    await allocateSalesOrder(salesOrder._id);
  } catch {
    // If allocation failed due to stock shortage, order remains in CONFIRMED status awaiting restock
  }

  return getSalesOrderById(salesOrder._id);
};

/**
 * Manually executes stock allocation on a confirmed sales order.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Allocated sales order.
 */
export const allocateSalesOrderAction = async (id) => {
  await allocateSalesOrder(id);
  return getSalesOrderById(id);
};

/**
 * Cancels a sales order and releases all reserved inventory.
 *
 * @param {string} id - Sales order identifier.
 * @param {object} _actor - Authenticated operator.
 * @returns {Promise<object>} Cancelled sales order.
 */
export const cancelSalesOrder = async (id, _actor) => {
  const salesOrder = await SalesOrder.findById(id);
  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  if (salesOrder.status === SO_STATUSES.SHIPPED || salesOrder.status === SO_STATUSES.DELIVERED) {
    throw ApiError.badRequest(`Cannot cancel an order that has already been ${salesOrder.status}`);
  }

  await deallocateSalesOrder(salesOrder._id);
  salesOrder.status = SO_STATUSES.CANCELLED;
  await salesOrder.save();

  return getSalesOrderById(salesOrder._id);
};
