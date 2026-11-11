/**
 * StockPilot WMS - Return Order / RMA Service.
 *
 * Implements reverse logistics workflows: RMA generation, dock intake receipt,
 * quality inspection grading, and transactional stock ledger disposition.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import {
  ReturnOrder,
  RETURN_TYPES,
  RMA_STATUSES,
  DISPOSITION_TYPES,
} from './returnOrder.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Customer } from '../customers/customer.model.js';
import { Supplier } from '../suppliers/supplier.model.js';
import { Product } from '../products/product.model.js';
import { Location } from '../locations/location.model.js';
import { SalesOrder } from '../outbound/salesOrder.model.js';
import { PurchaseOrder } from '../purchasing/purchaseOrder.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Formats an RMA sequence number (e.g. RMA-2026-0001).
 *
 * @returns {Promise<string>} Next formatted RMA identifier.
 */
export const generateRmaNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `RMA-${year}-`;
  const count = await ReturnOrder.countDocuments({
    rmaNumber: { $regex: `^${prefix}` },
  });
  return `${prefix}${(count + 1).toString().padStart(4, '0')}`;
};

/**
 * Creates a new Return Order / RMA.
 *
 * @param {object} payload - RMA fields.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created RMA document.
 */
export const createReturnOrder = async (payload, actor) => {
  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.badRequest('Target warehouse not found or is inactive');
  }

  let customer = null;
  if (payload.customer) {
    customer = await Customer.findById(payload.customer);
    if (!customer) {
      throw ApiError.badRequest('Customer not found');
    }
  }

  let supplier = null;
  if (payload.supplier) {
    supplier = await Supplier.findById(payload.supplier);
    if (!supplier) {
      throw ApiError.badRequest('Supplier not found');
    }
  }

  if (payload.salesOrder) {
    const so = await SalesOrder.findById(payload.salesOrder);
    if (!so) {
      throw ApiError.badRequest('Sales Order reference not found');
    }
    if (!customer && so.customer) {
      customer = await Customer.findById(so.customer);
    }
  }

  if (payload.purchaseOrder) {
    const po = await PurchaseOrder.findById(payload.purchaseOrder);
    if (!po) {
      throw ApiError.badRequest('Purchase Order reference not found');
    }
    if (!supplier && po.supplier) {
      supplier = await Supplier.findById(po.supplier);
    }
  }

  if (payload.returnType === RETURN_TYPES.CUSTOMER_RETURN && !customer) {
    throw ApiError.badRequest('Customer returns must reference a customer or valid sales order');
  }

  if (payload.returnType === RETURN_TYPES.SUPPLIER_RETURN && !supplier) {
    throw ApiError.badRequest('Supplier returns must reference a supplier or valid purchase order');
  }

  const validatedItems = [];
  for (const item of payload.items) {
    const product = await Product.findById(item.product);
    if (!product || !product.isActive) {
      throw ApiError.badRequest(`Product ${item.product} not found or inactive`);
    }

    validatedItems.push({
      product: product._id,
      expectedQty: Number(item.expectedQty),
      receivedQty: 0,
      inspectedQty: 0,
      condition: item.condition || 'NEW',
      disposition: DISPOSITION_TYPES.PENDING,
      reason: item.reason || 'OTHER',
      reasonNotes: item.reasonNotes || '',
      batch: item.batch || null,
      serialNumbers: item.serialNumbers || [],
    });
  }

  const rmaNumber = await generateRmaNumber();

  const returnOrder = await ReturnOrder.create({
    rmaNumber,
    returnType: payload.returnType,
    warehouse: warehouse._id,
    customer: customer ? customer._id : null,
    supplier: supplier ? supplier._id : null,
    salesOrder: payload.salesOrder || null,
    purchaseOrder: payload.purchaseOrder || null,
    status: RMA_STATUSES.PENDING_RECEIPT,
    items: validatedItems,
    trackingNumber: payload.trackingNumber || '',
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return getReturnOrderById(returnOrder._id);
};

/**
 * Lists return orders with filtering and pagination.
 *
 * @param {object} [filters={}] - Filter criteria.
 * @param {object} [pagination={}] - Pagination parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Paginated return orders.
 */
export const listReturnOrders = async (filters = {}, pagination = {}) => {
  const query = {};

  if (filters.warehouse) {
    query.warehouse = filters.warehouse;
  }
  if (filters.returnType) {
    query.returnType = filters.returnType;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.customer) {
    query.customer = filters.customer;
  }
  if (filters.supplier) {
    query.supplier = filters.supplier;
  }

  if (filters.search) {
    const term = filters.search.trim();
    query.$or = [
      { rmaNumber: { $regex: term, $options: 'i' } },
      { trackingNumber: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
    ];
  }

  const page = Math.max(1, Number(pagination.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(pagination.limit) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    ReturnOrder.find(query)
      .populate('warehouse', 'code name')
      .populate('customer', 'code name')
      .populate('supplier', 'code name')
      .populate('salesOrder', 'soNumber')
      .populate('purchaseOrder', 'poNumber')
      .populate('items.product', 'sku name trackingType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ReturnOrder.countDocuments(query),
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
 * Retrieves a single return order by ID with all references populated.
 *
 * @param {string} id - RMA identifier.
 * @returns {Promise<object>} Populated RMA document.
 */
export const getReturnOrderById = async (id) => {
  const returnOrder = await ReturnOrder.findById(id)
    .populate('warehouse', 'code name')
    .populate('customer', 'code name address')
    .populate('supplier', 'code name')
    .populate('salesOrder', 'soNumber items')
    .populate('purchaseOrder', 'poNumber items')
    .populate('items.product', 'sku name trackingType salePriceMinor costPriceMinor')
    .populate('items.targetLocation', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn')
    .populate('createdBy', 'name email');

  if (!returnOrder) {
    throw ApiError.notFound('Return Order not found');
  }

  return returnOrder;
};

/**
 * Records dock receipt intake of items on an RMA.
 *
 * @param {string} id - RMA identifier.
 * @param {object} payload - Intake payload with items received.
 * @returns {Promise<object>} Updated RMA.
 */
export const receiveReturnOrder = async (id, payload) => {
  const returnOrder = await ReturnOrder.findById(id);
  if (!returnOrder) {
    throw ApiError.notFound('Return Order not found');
  }

  if (
    returnOrder.status !== RMA_STATUSES.DRAFT &&
    returnOrder.status !== RMA_STATUSES.PENDING_RECEIPT &&
    returnOrder.status !== RMA_STATUSES.RECEIVED
  ) {
    throw ApiError.badRequest(
      `Cannot receive items for return order in status ${returnOrder.status}`,
    );
  }

  const receiptMap = new Map();
  for (const item of payload.items) {
    receiptMap.set(String(item.itemId), Number(item.receivedQty));
  }

  for (const line of returnOrder.items) {
    const lineId = String(line._id);
    if (receiptMap.has(lineId)) {
      const addedQty = receiptMap.get(lineId);
      line.receivedQty = Math.max(0, addedQty);
    }
  }

  returnOrder.status = RMA_STATUSES.RECEIVED;
  returnOrder.receivedAt = new Date();
  await returnOrder.save();

  return getReturnOrderById(id);
};

/**
 * Processes quality inspection decisions and commits atomic stock movements.
 *
 * @param {string} id - RMA identifier.
 * @param {object} payload - Items disposition details.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Disposed and updated RMA.
 */
export const processDisposition = async (id, payload, actor) => {
  const returnOrder = await ReturnOrder.findById(id);
  if (!returnOrder) {
    throw ApiError.notFound('Return Order not found');
  }

  if (
    returnOrder.status !== RMA_STATUSES.RECEIVED &&
    returnOrder.status !== RMA_STATUSES.UNDER_INSPECTION
  ) {
    throw ApiError.badRequest(
      `Cannot process disposition for RMA in status ${returnOrder.status}. It must be received first.`,
    );
  }

  const session = await mongoose.startSession();
  try {
    let updatedDoc;
    await session.withTransaction(async () => {
      const activeRma = await ReturnOrder.findById(id).session(session);
      const movementsToPost = [];

      for (const disp of payload.items) {
        const line = activeRma.items.find((it) => String(it._id) === String(disp.itemId));
        if (!line) {
          throw ApiError.badRequest(`RMA item line ${disp.itemId} not found`);
        }

        const qty = disp.inspectedQty ? Number(disp.inspectedQty) : line.receivedQty || line.expectedQty;
        if (qty <= 0) {
          throw ApiError.badRequest('Disposition quantity must be greater than zero');
        }

        let targetLocation = null;
        if (disp.targetLocationId) {
          targetLocation = await Location.findById(disp.targetLocationId).session(session);
          if (!targetLocation) {
            throw ApiError.badRequest(`Target location ${disp.targetLocationId} not found`);
          }
          if (String(targetLocation.warehouse) !== String(activeRma.warehouse)) {
            throw ApiError.badRequest('Target location must belong to the RMA warehouse facility');
          }
        }

        if (disp.disposition === DISPOSITION_TYPES.RESTOCK) {
          if (!targetLocation) {
            throw ApiError.badRequest('Restock disposition requires specifying a target storage bin');
          }

          if (activeRma.returnType === RETURN_TYPES.CUSTOMER_RETURN) {
            movementsToPost.push({
              movementType: MOVEMENT_TYPES.CUSTOMER_RETURN,
              product: line.product,
              warehouse: activeRma.warehouse,
              location: targetLocation._id,
              quantity: qty,
              batch: line.batch || null,
              serials: line.serialNumbers || [],
              referenceType: 'RETURN_ORDER',
              referenceId: activeRma._id.toString(),
              referenceNo: activeRma.rmaNumber,
              lineId: String(line._id),
              reason: `RMA Restock: ${activeRma.rmaNumber}`,
              consumesReservation: false,
            });
          }
        } else if (disp.disposition === DISPOSITION_TYPES.QUARANTINE) {
          if (!targetLocation) {
            throw ApiError.badRequest('Quarantine disposition requires a designated quarantine location');
          }

          if (activeRma.returnType === RETURN_TYPES.CUSTOMER_RETURN) {
            movementsToPost.push({
              movementType: MOVEMENT_TYPES.CUSTOMER_RETURN,
              product: line.product,
              warehouse: activeRma.warehouse,
              location: targetLocation._id,
              quantity: qty,
              batch: line.batch || null,
              serials: line.serialNumbers || [],
              referenceType: 'RETURN_ORDER',
              referenceId: activeRma._id.toString(),
              referenceNo: activeRma.rmaNumber,
              lineId: String(line._id),
              reason: `RMA Quarantine: ${activeRma.rmaNumber}`,
              consumesReservation: false,
            });
          }
        } else if (disp.disposition === DISPOSITION_TYPES.RETURN_TO_VENDOR) {
          if (!targetLocation) {
            throw ApiError.badRequest(
              'Supplier return to vendor requires source bin where items are being pulled from',
            );
          }

          movementsToPost.push({
            movementType: MOVEMENT_TYPES.SUPPLIER_RETURN,
            product: line.product,
            warehouse: activeRma.warehouse,
            location: targetLocation._id,
            quantity: -qty,
            batch: line.batch || null,
            serials: line.serialNumbers || [],
            referenceType: 'RETURN_ORDER',
            referenceId: activeRma._id.toString(),
            referenceNo: activeRma.rmaNumber,
            lineId: String(line._id),
            reason: `Supplier Return to Vendor: ${activeRma.rmaNumber}`,
            consumesReservation: false,
          });
        }

        line.disposition = disp.disposition;
        if (disp.condition) {
          line.condition = disp.condition;
        }
        line.inspectedQty = qty;
        if (targetLocation) {
          line.targetLocation = targetLocation._id;
        }
        if (disp.notes) {
          line.reasonNotes = disp.notes;
        }
      }

      if (movementsToPost.length > 0) {
        await postMovements({
          movements: movementsToPost,
          actor,
          session,
        });
      }

      const allDisposed = activeRma.items.every(
        (it) => it.disposition && it.disposition !== DISPOSITION_TYPES.PENDING,
      );

      if (allDisposed) {
        activeRma.status = RMA_STATUSES.COMPLETED;
        activeRma.completedAt = new Date();
      } else {
        activeRma.status = RMA_STATUSES.UNDER_INSPECTION;
        activeRma.inspectedAt = new Date();
      }

      await activeRma.save({ session });
      updatedDoc = activeRma;
    });

    return getReturnOrderById(updatedDoc._id);
  } finally {
    await session.endSession();
  }
};

/**
 * Cancels a draft or pending RMA.
 *
 * @param {string} id - RMA identifier.
 * @returns {Promise<object>} Cancelled RMA document.
 */
export const cancelReturnOrder = async (id) => {
  const returnOrder = await ReturnOrder.findById(id);
  if (!returnOrder) {
    throw ApiError.notFound('Return Order not found');
  }

  if (returnOrder.status === RMA_STATUSES.COMPLETED) {
    throw ApiError.badRequest('Cannot cancel an already completed Return Order');
  }

  returnOrder.status = RMA_STATUSES.CANCELLED;
  await returnOrder.save();

  return getReturnOrderById(id);
};
