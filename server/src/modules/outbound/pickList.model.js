/**
 * StockPilot WMS - Wave / Pick List Mongoose model.
 *
 * Coordinates multi-order or single-order picking waves with optimized
 * bin walk paths and serial/lot capture.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const PICK_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const PICK_ITEM_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  PICKED: 'PICKED',
  SHORTAGE: 'SHORTAGE',
});

const pickTaskItemSchema = new mongoose.Schema(
  {
    salesOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalesOrder',
      required: true,
      index: true,
    },
    salesOrderItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
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
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Pick quantity must be positive'],
    },
    pickedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(PICK_ITEM_STATUSES),
      default: PICK_ITEM_STATUSES.PENDING,
    },
  },
  { _id: true },
);

const pickListSchema = new mongoose.Schema(
  {
    pickNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      enum: Object.values(PICK_STATUSES),
      default: PICK_STATUSES.PENDING,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    salesOrders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalesOrder',
      },
    ],
    items: {
      type: [pickTaskItemSchema],
      validate: {
        validator: (items) => items && items.length > 0,
        message: 'Pick list must contain at least one item to pick',
      },
    },
    stagingLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    startedAt: {
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

pickListSchema.index({ warehouse: 1, status: 1 });

export const PickList = mongoose.model('PickList', pickListSchema, 'picklists');
