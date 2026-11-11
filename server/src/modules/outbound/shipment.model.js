/**
 * StockPilot WMS - Outbound Shipment Mongoose model.
 *
 * Tracks final cartonization, packaging validation, carrier handoff,
 * and dispatch execution.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const SHIPMENT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  PACKED: 'PACKED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
});

const shipmentPackageSchema = new mongoose.Schema(
  {
    packageNumber: {
      type: String,
      required: true,
      trim: true,
    },
    weightKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    boxType: {
      type: String,
      trim: true,
      default: 'STANDARD_BOX',
    },
  },
  { _id: true },
);

const shipmentItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Shipment quantity must be positive'],
    },
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
    serials: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Serial',
      },
    ],
  },
  { _id: true },
);

const shipmentSchema = new mongoose.Schema(
  {
    shipmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
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
      enum: Object.values(SHIPMENT_STATUSES),
      default: SHIPMENT_STATUSES.DRAFT,
      index: true,
    },
    carrier: {
      type: String,
      trim: true,
      default: '',
    },
    trackingNumber: {
      type: String,
      trim: true,
      default: '',
    },
    packages: [shipmentPackageSchema],
    items: {
      type: [shipmentItemSchema],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Shipment must contain at least one item',
      },
    },
    shippingAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'US' },
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

shipmentSchema.index({ warehouse: 1, status: 1 });
shipmentSchema.index({ trackingNumber: 1 });

export const Shipment = mongoose.model('Shipment', shipmentSchema, 'shipments');
