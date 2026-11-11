/**
 * StockPilot WMS - Putaway Task Mongoose Model.
 *
 * Tracks directed putaway movements moving inventory from receiving staging/dock
 * to recommended permanent storage bins.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const PUTAWAY_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const putawayTaskSchema = new mongoose.Schema(
  {
    taskNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    goodsReceipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GoodsReceipt',
      required: true,
      index: true,
    },
    goodsReceiptItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    sourceLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    suggestedLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
    },
    destinationLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Quantity must be greater than zero'],
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
    status: {
      type: String,
      enum: Object.values(PUTAWAY_STATUSES),
      default: PUTAWAY_STATUSES.PENDING,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
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
    notes: {
      type: String,
      trim: true,
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

putawayTaskSchema.index({ warehouse: 1, status: 1 });
putawayTaskSchema.index({ product: 1, status: 1 });

export const PutawayTask = mongoose.model('PutawayTask', putawayTaskSchema);
