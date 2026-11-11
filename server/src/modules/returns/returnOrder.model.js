/**
 * StockPilot WMS - Return Order / RMA Mongoose model.
 *
 * Tracks customer returns and supplier RMAs through dock receiving,
 * quality inspection grading, and atomic stock ledger disposition.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const RETURN_TYPES = Object.freeze({
  CUSTOMER_RETURN: 'CUSTOMER_RETURN',
  SUPPLIER_RETURN: 'SUPPLIER_RETURN',
});

export const RMA_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_RECEIPT: 'PENDING_RECEIPT',
  RECEIVED: 'RECEIVED',
  UNDER_INSPECTION: 'UNDER_INSPECTION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const ITEM_CONDITIONS = Object.freeze({
  NEW: 'NEW',
  LIKE_NEW: 'LIKE_NEW',
  DAMAGED: 'DAMAGED',
  DEFECTIVE: 'DEFECTIVE',
  EXPIRED: 'EXPIRED',
});

export const DISPOSITION_TYPES = Object.freeze({
  PENDING: 'PENDING',
  RESTOCK: 'RESTOCK',
  SCRAP: 'SCRAP',
  QUARANTINE: 'QUARANTINE',
  RETURN_TO_VENDOR: 'RETURN_TO_VENDOR',
});

export const RETURN_REASONS = Object.freeze({
  DEFECTIVE_PRODUCT: 'DEFECTIVE_PRODUCT',
  WRONG_ITEM_SENT: 'WRONG_ITEM_SENT',
  CUSTOMER_CHANGED_MIND: 'CUSTOMER_CHANGED_MIND',
  TRANSIT_DAMAGE: 'TRANSIT_DAMAGE',
  SUPPLIER_RECALL: 'SUPPLIER_RECALL',
  OVERSTOCK: 'OVERSTOCK',
  OTHER: 'OTHER',
});

const returnOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    expectedQty: {
      type: Number,
      required: true,
      min: [0.001, 'Expected quantity must be positive'],
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    inspectedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    condition: {
      type: String,
      enum: Object.values(ITEM_CONDITIONS),
      default: ITEM_CONDITIONS.NEW,
    },
    disposition: {
      type: String,
      enum: Object.values(DISPOSITION_TYPES),
      default: DISPOSITION_TYPES.PENDING,
      index: true,
    },
    targetLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    serialNumbers: [
      {
        type: String,
        trim: true,
      },
    ],
    reason: {
      type: String,
      enum: Object.values(RETURN_REASONS),
      default: RETURN_REASONS.OTHER,
    },
    reasonNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true },
);

const returnOrderSchema = new mongoose.Schema(
  {
    rmaNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    returnType: {
      type: String,
      enum: Object.values(RETURN_TYPES),
      required: true,
      default: RETURN_TYPES.CUSTOMER_RETURN,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
      index: true,
    },
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
      default: null,
      index: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(RMA_STATUSES),
      default: RMA_STATUSES.DRAFT,
      index: true,
    },
    items: {
      type: [returnOrderItemSchema],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Return order must contain at least one item line',
      },
    },
    trackingNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    inspectedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

returnOrderSchema.index({ warehouse: 1, status: 1 });
returnOrderSchema.index({ returnType: 1, status: 1 });

export const ReturnOrder = mongoose.model('ReturnOrder', returnOrderSchema, 'returnorders');
