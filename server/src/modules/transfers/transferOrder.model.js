/**
 * StockPilot WMS - Transfer Order Mongoose model.
 *
 * Coordinates inter-facility warehouse transfers with in-transit waybill tracking
 * and intra-warehouse bin-to-bin relocations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const TRANSFER_TYPES = Object.freeze({
  INTRA_WAREHOUSE: 'INTRA_WAREHOUSE',
  INTER_WAREHOUSE: 'INTER_WAREHOUSE',
});

export const TRANSFER_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  PENDING_DISPATCH: 'PENDING_DISPATCH',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const transferOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    requestedQty: {
      type: Number,
      required: true,
      min: [0.001, 'Requested transfer quantity must be positive'],
    },
    dispatchedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
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

const transferOrderSchema = new mongoose.Schema(
  {
    transferNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    transferType: {
      type: String,
      enum: Object.values(TRANSFER_TYPES),
      default: TRANSFER_TYPES.INTER_WAREHOUSE,
      required: true,
      index: true,
    },
    originWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    destinationWarehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(TRANSFER_STATUSES),
      default: TRANSFER_STATUSES.PENDING_DISPATCH,
      index: true,
    },
    items: {
      type: [transferOrderItemSchema],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Transfer order must contain at least one item line',
      },
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
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    receivedAt: {
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

transferOrderSchema.index({ originWarehouse: 1, status: 1 });
transferOrderSchema.index({ destinationWarehouse: 1, status: 1 });

export const TransferOrder = mongoose.model('TransferOrder', transferOrderSchema, 'transferorders');
