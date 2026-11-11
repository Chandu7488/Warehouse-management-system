/**
 * StockPilot WMS - Sales Order Mongoose model.
 *
 * Captures customer purchasing commitments, line-item allocations,
 * and tracks the outbound fulfillment lifecycle.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const SO_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  ALLOCATED: 'ALLOCATED',
  PICKING: 'PICKING',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

const allocationItemSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
    serial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Serial',
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Allocated quantity must be positive'],
    },
  },
  { _id: true },
);

const salesOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: [1, 'Ordered quantity must be at least 1'],
    },
    allocatedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    pickedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    packedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitPriceMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPriceMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    allocations: [allocationItemSchema],
  },
  { _id: true },
);

const salesOrderSchema = new mongoose.Schema(
  {
    soNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
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
      enum: Object.values(SO_STATUSES),
      default: SO_STATUSES.DRAFT,
      index: true,
    },
    items: {
      type: [salesOrderItemSchema],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Sales order must contain at least one line item',
      },
    },
    shippingAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'US' },
    },
    subtotalMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    taxMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMinor: {
      type: Number,
      required: true,
      min: 0,
    },
    requestedDeliveryDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
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

salesOrderSchema.index({ warehouse: 1, status: 1 });
salesOrderSchema.index({ customer: 1, createdAt: -1 });

export const SalesOrder = mongoose.model('SalesOrder', salesOrderSchema, 'salesorders');
