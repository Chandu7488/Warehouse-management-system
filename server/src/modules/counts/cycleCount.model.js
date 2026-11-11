/**
 * StockPilot WMS - Cycle Count & Physical Inventory Mongoose Model.
 *
 * Coordinates periodic cycle counting sessions, wall-to-wall physical inventory audits,
 * blind count capture, variance analysis, and stock ledger reconciliation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const COUNT_TYPES = Object.freeze({
  CYCLE_COUNT: 'CYCLE_COUNT',
  FULL_PHYSICAL: 'FULL_PHYSICAL',
  SPOT_CHECK: 'SPOT_CHECK',
});

export const COUNT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COUNTED: 'COUNTED',
  RECONCILED: 'RECONCILED',
  CANCELLED: 'CANCELLED',
});

export const COUNT_ITEM_STATUSES = Object.freeze({
  PENDING: 'PENDING',
  COUNTED: 'COUNTED',
  RECOUNT_REQUESTED: 'RECOUNT_REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const cycleCountItemSchema = new mongoose.Schema(
  {
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
    snapshotQty: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    countedQty: {
      type: Number,
      default: null,
      min: 0,
    },
    varianceQty: {
      type: Number,
      default: 0,
    },
    unitCostMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    varianceValueMinor: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(COUNT_ITEM_STATUSES),
      default: COUNT_ITEM_STATUSES.PENDING,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        return ret;
      },
    },
  },
);

const cycleCountSchema = new mongoose.Schema(
  {
    countNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(COUNT_TYPES),
      default: COUNT_TYPES.CYCLE_COUNT,
      required: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(COUNT_STATUSES),
      default: COUNT_STATUSES.DRAFT,
      required: true,
      index: true,
    },
    blindCount: {
      type: Boolean,
      default: true,
    },
    scope: {
      locations: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Location',
        },
      ],
      categories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
      ],
      products: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
        },
      ],
    },
    items: [cycleCountItemSchema],
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    countedAt: {
      type: Date,
      default: null,
    },
    reconciledAt: {
      type: Date,
      default: null,
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchedItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    varianceItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    netVarianceValueMinor: {
      type: Number,
      default: 0,
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
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        return ret;
      },
    },
  },
);

cycleCountSchema.index({ warehouse: 1, status: 1 });
cycleCountSchema.index({ createdAt: -1 });

export const CycleCount = mongoose.model('CycleCount', cycleCountSchema, 'cyclecounts');
