/**
 * StockPilot WMS - Goods Receipt Note (GRN) Domain Service.
 *
 * Implements physical stock receiving into dock locations, lot/serial registration,
 * purchase order fulfillment updates, quality inspection, and putaway task creation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { GoodsReceipt, GRN_STATUSES } from './goodsReceipt.model.js';
import { PurchaseOrder, PO_STATUSES } from '../purchasing/purchaseOrder.model.js';
import { PutawayTask, PUTAWAY_STATUSES } from './putawayTask.model.js';
import { Supplier } from '../suppliers/supplier.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { Location, LOCATION_PURPOSES } from '../locations/location.model.js';
import { Product, TRACKING_TYPES } from '../products/product.model.js';
import { Batch } from '../inventory/batch.model.js';
import { Serial, SERIAL_STATUSES } from '../inventory/serial.model.js';
import { postMovements } from '../inventory/stockPosting.service.js';
import { MOVEMENT_TYPES } from '../inventory/stockLedgerEntry.model.js';
import { suggestPutawayLocation } from './putaway.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { getSkip, buildPaginationMeta } from '../../utils/pagination.js';

/**
 * Generates an auto-incrementing sequential GRN number.
 *
 * @returns {Promise<string>} Sequential GRN number.
 */
const generateGrnNumber = async () => {
  const count = await GoodsReceipt.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1).padStart(4, '0');
  return `GRN-${year}-${sequence}`;
};

/**
 * Generates an auto-incrementing sequential Putaway task number.
 *
 * @returns {Promise<string>} Sequential task number.
 */
const generatePutawayTaskNumber = async (offset = 0) => {
  const count = await PutawayTask.countDocuments();
  const year = new Date().getFullYear();
  const sequence = String(count + 1 + offset).padStart(4, '0');
  let taskNumber = `PUT-${year}-${sequence}`;
  let existing = await PutawayTask.findOne({ taskNumber });
  while (existing) {
    taskNumber = `PUT-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    existing = await PutawayTask.findOne({ taskNumber });
  }
  return taskNumber;
};

/**
 * Locates the warehouse receiving staging dock location.
 *
 * @param {string} warehouseId - Warehouse identifier.
 * @param {string} [preferredLocationId] - Optional explicit dock location.
 * @returns {Promise<object>} Active receiving location.
 */
const resolveReceivingLocation = async (warehouseId, preferredLocationId) => {
  if (preferredLocationId) {
    const loc = await Location.findById(preferredLocationId);
    if (loc && loc.isActive && String(loc.warehouse) === String(warehouseId)) {
      return loc;
    }
  }

  const standardReceiving = await Location.findOne({
    warehouse: warehouseId,
    code: 'RECEIVING',
    isActive: true,
  });

  if (standardReceiving) {
    return standardReceiving;
  }

  const purposeReceiving = await Location.findOne({
    warehouse: warehouseId,
    purpose: LOCATION_PURPOSES.RECEIVING,
    isActive: true,
  });

  if (purposeReceiving) {
    return purposeReceiving;
  }

  const fallback = await Location.findOne({
    warehouse: warehouseId,
    isActive: true,
  });

  if (!fallback) {
    throw ApiError.unprocessable('No active locations configured for this warehouse');
  }

  return fallback;
};

/**
 * Records physical delivery of inbound goods at the warehouse receiving dock.
 *
 * @param {object} payload - GRN creation parameters.
 * @param {object} actor - Authenticated operator.
 * @returns {Promise<object>} Created Goods Receipt document.
 */
export const createGoodsReceipt = async (payload, actor) => {
  const supplier = await Supplier.findById(payload.supplier);
  if (!supplier || !supplier.isActive) {
    throw ApiError.unprocessable('Supplier not found or inactive');
  }

  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse || !warehouse.isActive) {
    throw ApiError.unprocessable('Warehouse not found or inactive');
  }

  const receivingLocation = await resolveReceivingLocation(
    warehouse._id,
    payload.receivingLocation,
  );

  let poDoc = null;
  if (payload.purchaseOrder) {
    poDoc = await PurchaseOrder.findById(payload.purchaseOrder);
    if (!poDoc) {
      throw ApiError.unprocessable('Purchase order not found');
    }
    if (String(poDoc.supplier) !== String(supplier._id)) {
      throw ApiError.badRequest('Purchase order supplier does not match GRN supplier');
    }
    if (String(poDoc.warehouse) !== String(warehouse._id)) {
      throw ApiError.badRequest('Purchase order destination warehouse does not match GRN warehouse');
    }
    if (
      poDoc.status !== PO_STATUSES.CONFIRMED &&
      poDoc.status !== PO_STATUSES.PARTIALLY_RECEIVED
    ) {
      throw ApiError.badRequest(
        `Cannot receive stock against purchase order in status ${poDoc.status}`,
      );
    }
  }

  const productIds = payload.items.map((i) => i.product);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  if (products.length !== productIds.length) {
    throw ApiError.unprocessable('One or more products not found in catalog');
  }

  const preparedItems = [];
  const registeredBatches = new Map();
  const registeredSerials = new Map();

  for (let idx = 0; idx < payload.items.length; idx += 1) {
    const item = payload.items[idx];
    const product = productMap.get(item.product);
    const trackingType = product.trackingType || product.tracking || TRACKING_TYPES.NONE;

    let batchDoc = null;
    if (trackingType === TRACKING_TYPES.BATCH) {
      if (!item.batchNumber) {
        throw ApiError.badRequest(`Batch number is required for product ${product.sku}`);
      }
      const bNumber = item.batchNumber.trim().toUpperCase();
      batchDoc = await Batch.findOne({
        product: product._id,
        batchNumber: bNumber,
      });

      if (!batchDoc) {
        batchDoc = await Batch.create({
          product: product._id,
          batchNumber: bNumber,
          expiresOn: item.expiresOn ? new Date(item.expiresOn) : null,
        });
      }
      registeredBatches.set(idx, batchDoc);
    }

    const serialDocs = [];
    if (trackingType === TRACKING_TYPES.SERIAL) {
      const serialList = item.serialNumbers || [];
      if (serialList.length !== Number(item.receivedQty)) {
        throw ApiError.badRequest(
          `Product ${product.sku} requires exactly ${item.receivedQty} serial number(s) (provided: ${serialList.length})`,
        );
      }

      for (const sNum of serialList) {
        const cleanSerial = sNum.trim().toUpperCase();
        const existingSerial = await Serial.findOne({
          product: product._id,
          serialNumber: cleanSerial,
        });

        if (existingSerial) {
          throw ApiError.conflict(`Serial number ${cleanSerial} already exists for ${product.sku}`);
        }

        const createdSerial = await Serial.create({
          product: product._id,
          serialNumber: cleanSerial,
          status: SERIAL_STATUSES.IN_STOCK,
          warehouse: warehouse._id,
          location: receivingLocation._id,
        });
        serialDocs.push(createdSerial);
      }
      registeredSerials.set(idx, serialDocs);
    }

    preparedItems.push({
      _id: new mongoose.Types.ObjectId(),
      product: product._id,
      purchaseOrderLineId: item.purchaseOrderLineId || null,
      receivedQty: item.receivedQty,
      acceptedQty: item.receivedQty,
      rejectedQty: 0,
      unitCostMinor: item.unitCostMinor ?? product.costPriceMinor ?? 0,
      batch: batchDoc ? batchDoc._id : null,
      batchNumber: batchDoc ? batchDoc.batchNumber : null,
      expiresOn: batchDoc ? batchDoc.expiresOn : null,
      serials: serialDocs.map((s) => s._id),
    });
  }

  let grnNumber = await generateGrnNumber();
  let existingGrn = await GoodsReceipt.findOne({ grnNumber });
  while (existingGrn) {
    grnNumber = `GRN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    existingGrn = await GoodsReceipt.findOne({ grnNumber });
  }

  const session = await mongoose.startSession();
  try {
    let createdGrn;
    await session.withTransaction(async () => {
      const [grn] = await GoodsReceipt.create(
        [
          {
            grnNumber,
            purchaseOrder: poDoc ? poDoc._id : null,
            supplier: supplier._id,
            warehouse: warehouse._id,
            receivingLocation: receivingLocation._id,
            status: GRN_STATUSES.COMPLETED,
            receivedDate: new Date(),
            vendorInvoiceNo: payload.vendorInvoiceNo || null,
            carrier: payload.carrier || null,
            trackingNumber: payload.trackingNumber || null,
            items: preparedItems,
            notes: payload.notes || '',
            createdBy: actor._id || actor.id,
          },
        ],
        { session },
      );
      createdGrn = grn;

      const movements = [];
      for (let idx = 0; idx < preparedItems.length; idx += 1) {
        const item = preparedItems[idx];
        const serials = registeredSerials.get(idx) || [];

        if (serials.length > 0) {
          for (const s of serials) {
            movements.push({
              movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
              product: item.product,
              warehouse: warehouse._id,
              location: receivingLocation._id,
              batch: item.batch,
              serial: s._id,
              quantity: 1,
              unitCostMinor: item.unitCostMinor,
              referenceType: 'GOODS_RECEIPT',
              referenceId: grn._id.toString(),
              referenceNo: grn.grnNumber,
              lineId: s._id,
              reason: `Dock Receipt GRN ${grn.grnNumber}`,
            });
          }
        } else {
          movements.push({
            movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
            product: item.product,
            warehouse: warehouse._id,
            location: receivingLocation._id,
            batch: item.batch,
            quantity: item.receivedQty,
            unitCostMinor: item.unitCostMinor,
            referenceType: 'GOODS_RECEIPT',
            referenceId: grn._id.toString(),
            referenceNo: grn.grnNumber,
            lineId: item._id,
            reason: `Dock Receipt GRN ${grn.grnNumber}`,
          });
        }
      }

      await postMovements({
        movements,
        session,
        actor,
      });

      if (payload.purchaseOrder) {
        const po = await PurchaseOrder.findById(payload.purchaseOrder).session(session);
        if (po) {
          for (const item of preparedItems) {
            if (item.purchaseOrderLineId) {
              const line = po.items.id(item.purchaseOrderLineId);
              if (line) {
                line.receivedQty += item.receivedQty;
              }
            } else {
              const line = po.items.find(
                (l) =>
                  String(l.product?._id || l.product) ===
                    String(item.product?._id || item.product) && l.receivedQty < l.orderedQty,
              );
              if (line) {
                line.receivedQty += item.receivedQty;
              }
            }
          }

          const isFullyReceived = po.items.every((l) => l.receivedQty >= l.orderedQty);
          po.status = isFullyReceived
            ? PO_STATUSES.COMPLETED
            : PO_STATUSES.PARTIALLY_RECEIVED;
          await po.save({ session });
        }
      }

      for (let idx = 0; idx < preparedItems.length; idx += 1) {
        const item = preparedItems[idx];
        const suggestedLoc = await suggestPutawayLocation({
          warehouseId: warehouse._id.toString(),
          productId: item.product.toString(),
          batchId: item.batch ? item.batch.toString() : null,
        });

        const taskNumber = await generatePutawayTaskNumber(idx);
        await PutawayTask.create(
          [
            {
              taskNumber,
              goodsReceipt: grn._id,
              goodsReceiptItemId: item._id,
              product: item.product,
              warehouse: warehouse._id,
              sourceLocation: receivingLocation._id,
              suggestedLocation: suggestedLoc._id,
              quantity: item.receivedQty,
              batch: item.batch,
              serials: item.serials,
              status: PUTAWAY_STATUSES.PENDING,
              createdBy: actor._id || actor.id,
            },
          ],
          { session },
        );
      }
    });

    return getGoodsReceiptById(createdGrn._id.toString());
  } finally {
    await session.endSession();
  }
};

/**
 * Lists goods receipts with filtering and pagination.
 *
 * @param {object} criteria - Search and filter parameters.
 * @returns {Promise<object>} Paginated goods receipt list.
 */
export const listGoodsReceipts = async (criteria = {}) => {
  const { warehouse, supplier, purchaseOrder, status, search, page = 1, limit = 20 } = criteria;
  const filter = {};

  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (supplier) {
    filter.supplier = supplier;
  }
  if (purchaseOrder) {
    filter.purchaseOrder = purchaseOrder;
  }
  if (status) {
    filter.status = status;
  }
  if (search) {
    filter.grnNumber = { $regex: search.trim(), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    GoodsReceipt.find(filter)
      .populate('supplier', 'name code email')
      .populate('warehouse', 'name code')
      .populate('receivingLocation', 'code path type purpose')
      .populate('purchaseOrder', 'poNumber status')
      .populate('items.product', 'sku name barcode trackingType unit')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    GoodsReceipt.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta({ page: Number(page), limit: Number(limit), total }),
  };
};

/**
 * Retrieves a single goods receipt by identifier.
 *
 * @param {string} id - GRN identifier.
 * @returns {Promise<object>} Goods receipt document.
 */
export const getGoodsReceiptById = async (id) => {
  const grn = await GoodsReceipt.findById(id)
    .populate('supplier', 'name code email address phone')
    .populate('warehouse', 'name code')
    .populate('receivingLocation', 'code path type purpose')
    .populate('purchaseOrder', 'poNumber status orderDate')
    .populate('items.product', 'sku name barcode trackingType unit costPriceMinor')
    .populate('items.batch', 'batchNumber expiresOn status')
    .populate('items.serials', 'serialNumber status')
    .populate('createdBy', 'firstName lastName email')
    .populate('inspectedBy', 'firstName lastName email');

  if (!grn) {
    throw ApiError.notFound('Goods receipt not found');
  }
  return grn;
};
