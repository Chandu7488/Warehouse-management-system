/**
 * StockPilot WMS - Outbound Shipping & Dispatch Domain Service.
 *
 * Implements final cartonization, courier handoff, and transactional stock ledger
 * posting with reservation clearance for sales issues.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { Shipment, SHIPMENT_STATUSES } from './shipment.model.js';
import { SalesOrder, SO_STATUSES } from './salesOrder.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Generates an auto-incrementing sequential shipment number.
 *
 * @returns {Promise<string>} Sequential shipment number.
 */
const generateShipmentNumber = async () => {
  const count = await Shipment.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  let shipmentNumber = `SHP-${year}-${sequence}`;
  let existing = await Shipment.findOne({ shipmentNumber });
  while (existing) {
    shipmentNumber = `SHP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    existing = await Shipment.findOne({ shipmentNumber });
  }
  return shipmentNumber;
};

/**
 * Creates an outbound shipment document against a packed sales order.
 *
 * @param {object} payload - Creation parameters.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created shipment document.
 */
export const createShipment = async (payload, actor) => {
  const salesOrder = await SalesOrder.findById(payload.salesOrder);
  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  if (
    salesOrder.status !== SO_STATUSES.PACKED &&
    salesOrder.status !== SO_STATUSES.PICKING &&
    salesOrder.status !== SO_STATUSES.ALLOCATED
  ) {
    throw ApiError.badRequest(
      `Cannot create shipment for order in ${salesOrder.status} status. Order must be ALLOCATED or PACKED`,
    );
  }

  const existingShipment = await Shipment.findOne({
    salesOrder: salesOrder._id,
    status: { $ne: SHIPMENT_STATUSES.CANCELLED },
  });

  if (existingShipment) {
    return getShipmentById(existingShipment._id);
  }

  const shipmentItems = [];
  for (const line of salesOrder.items) {
    for (const alloc of line.allocations) {
      shipmentItems.push({
        product: line.product,
        quantity: alloc.quantity,
        location: alloc.location,
        batch: alloc.batch || null,
        serials: alloc.serial ? [alloc.serial] : [],
      });
    }
  }

  if (shipmentItems.length === 0) {
    throw ApiError.badRequest('No allocated items found on sales order to ship');
  }

  const shipmentNumber = await generateShipmentNumber();

  const shipment = await Shipment.create({
    shipmentNumber,
    salesOrder: salesOrder._id,
    warehouse: salesOrder.warehouse,
    status: SHIPMENT_STATUSES.PACKED,
    carrier: payload.carrier || '',
    trackingNumber: payload.trackingNumber || '',
    packages: payload.packages || [{ packageNumber: 'PKG-01', weightKg: 1, boxType: 'STANDARD_BOX' }],
    items: shipmentItems,
    shippingAddress: salesOrder.shippingAddress,
    notes: payload.notes || '',
    createdBy: actor._id || actor.id,
  });

  return getShipmentById(shipment._id);
};

/**
 * Lists outbound shipments with filtering and pagination.
 *
 * @param {object} criteria - Search and filter parameters.
 * @returns {Promise<object>} Paginated shipments collection.
 */
export const listShipments = async (criteria = {}) => {
  const { warehouse, salesOrder, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (salesOrder) {
    filter.salesOrder = salesOrder;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.$or = [
      { shipmentNumber: { $regex: search.trim(), $options: 'i' } },
      { trackingNumber: { $regex: search.trim(), $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Shipment.find(filter)
      .populate('salesOrder', 'soNumber status customer')
      .populate('warehouse', 'name code')
      .populate('items.product', 'sku name barcode')
      .populate('dispatchedBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    Shipment.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single shipment document by identifier.
 *
 * @param {string} id - Shipment identifier.
 * @returns {Promise<object>} Populated shipment document.
 */
export const getShipmentById = async (id) => {
  const shipment = await Shipment.findById(id)
    .populate('salesOrder', 'soNumber status customer shippingAddress totalMinor')
    .populate('warehouse', 'name code')
    .populate('items.product', 'sku name barcode trackingType unit')
    .populate('items.location', 'code path type purpose')
    .populate('items.batch', 'batchNumber expiresOn')
    .populate('items.serials', 'serialNumber status')
    .populate('dispatchedBy', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email');

  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }

  return shipment;
};

/**
 * Dispatches an outbound shipment, updating carrier tracking, posting SALES_ISSUE
 * to the immutable stock ledger, and clearing inventory reservations.
 *
 * @param {string} id - Shipment identifier.
 * @param {object} payload - Dispatch parameters (carrier, trackingNumber, notes).
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Dispatched shipment.
 */
export const dispatchShipment = async (id, payload, actor) => {
  const shipment = await Shipment.findById(id);
  if (!shipment) {
    throw ApiError.notFound('Shipment not found');
  }

  if (shipment.status === SHIPMENT_STATUSES.DISPATCHED) {
    throw ApiError.badRequest('Shipment has already been dispatched');
  }

  const salesOrder = await SalesOrder.findById(shipment.salesOrder);
  if (!salesOrder) {
    throw ApiError.notFound('Linked sales order not found');
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Prepare ledger movements for stock deduction
    const movements = [];
    for (const item of shipment.items) {
      if (item.serials && item.serials.length > 0) {
        for (const sId of item.serials) {
          movements.push({
            movementType: MOVEMENT_TYPES.SALES_ISSUE,
            product: item.product,
            warehouse: shipment.warehouse,
            location: item.location,
            batch: item.batch || null,
            serial: sId,
            quantity: -1,
            consumesReservation: true,
            referenceType: 'SALES_ORDER',
            referenceId: salesOrder._id.toString(),
            referenceNo: shipment.shipmentNumber,
            lineId: sId.toString(),
            reason: `Outbound customer dispatch: ${shipment.shipmentNumber}`,
          });
        }
      } else {
        movements.push({
          movementType: MOVEMENT_TYPES.SALES_ISSUE,
          product: item.product,
          warehouse: shipment.warehouse,
          location: item.location,
          batch: item.batch || null,
          serial: null,
          quantity: -item.quantity,
          consumesReservation: true,
          referenceType: 'SALES_ORDER',
          referenceId: salesOrder._id.toString(),
          referenceNo: shipment.shipmentNumber,
          lineId: `${salesOrder._id}_${item.product}_${item.location}_${item.batch || '0'}`,
          reason: `Outbound customer dispatch: ${shipment.shipmentNumber}`,
        });
      }
    }

    // Post negative stock movements atomically with reservation consumption
    await postMovements({ movements, actor, session });

    // Update shipment
    if (payload.carrier) {
      shipment.carrier = payload.carrier.trim();
    }
    if (payload.trackingNumber) {
      shipment.trackingNumber = payload.trackingNumber.trim();
    }
    if (payload.notes) {
      shipment.notes = payload.notes.trim();
    }
    shipment.status = SHIPMENT_STATUSES.DISPATCHED;
    shipment.dispatchedAt = new Date();
    shipment.dispatchedBy = actor._id || actor.id;
    await shipment.save({ session });

    // Update sales order
    salesOrder.status = SO_STATUSES.SHIPPED;
    for (const item of shipment.items) {
      const soLine = salesOrder.items.find(
        (l) => l.product.toString() === item.product.toString(),
      );
      if (soLine) {
        soLine.shippedQty = (soLine.shippedQty || 0) + item.quantity;
      }
    }
    await salesOrder.save({ session });

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }

  return getShipmentById(shipment._id);
};
