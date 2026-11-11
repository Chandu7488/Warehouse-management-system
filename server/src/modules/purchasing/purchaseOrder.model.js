/**
 * StockPilot WMS - Purchase Order Mongoose Model.
 *
 * Defines commercial purchase orders placed with suppliers for inbound warehouse inventory.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const PO_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: [0.001, 'Ordered quantity must be greater than zero'],
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: [0, 'Received quantity cannot be negative'],
    },
    unitPriceMinor: {
      type: Number,
      default: 0,
      min: [0, 'Unit price cannot be negative'],
    },
    totalPriceMinor: {
      type: Number,
      default: 0,
      min: [0, 'Total price cannot be negative'],
    },
  },
  { _id: true },
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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
    status: {
      type: String,
      enum: Object.values(PO_STATUSES),
      default: PO_STATUSES.DRAFT,
      index: true,
    },
    orderDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    items: {
      type: [purchaseOrderItemSchema],
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'A purchase order must include at least one item line',
      },
    },
    subtotalMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

purchaseOrderSchema.index({ warehouse: 1, status: 1 });
purchaseOrderSchema.index({ supplier: 1, status: 1 });

export const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
