/**
 * StockPilot WMS - Goods Receipt Note (GRN) Mongoose Model.
 *
 * Records physical delivery of purchased stock at the warehouse receiving dock.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const GRN_STATUSES = Object.freeze({
  PENDING_INSPECTION: 'PENDING_INSPECTION',
  ACCEPTED: 'ACCEPTED',
  PARTIALLY_ACCEPTED: 'PARTIALLY_ACCEPTED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
});

const goodsReceiptItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    purchaseOrderLineId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    receivedQty: {
      type: Number,
      required: true,
      min: [0.001, 'Received quantity must be greater than zero'],
    },
    acceptedQty: {
      type: Number,
      default: 0,
      min: [0, 'Accepted quantity cannot be negative'],
    },
    rejectedQty: {
      type: Number,
      default: 0,
      min: [0, 'Rejected quantity cannot be negative'],
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    unitCostMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    batchNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    expiresOn: {
      type: Date,
      default: null,
    },
    serials: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Serial',
      },
    ],
  },
  { _id: true },
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    grnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    receivingLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(GRN_STATUSES),
      default: GRN_STATUSES.COMPLETED,
      index: true,
    },
    receivedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    vendorInvoiceNo: {
      type: String,
      trim: true,
      default: null,
    },
    carrier: {
      type: String,
      trim: true,
      default: null,
    },
    trackingNumber: {
      type: String,
      trim: true,
      default: null,
    },
    items: {
      type: [goodsReceiptItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A goods receipt note must contain at least one item line',
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    inspectedAt: {
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

goodsReceiptSchema.index({ warehouse: 1, receivedDate: -1 });
goodsReceiptSchema.index({ supplier: 1, receivedDate: -1 });

export const GoodsReceipt = mongoose.model('GoodsReceipt', goodsReceiptSchema);
