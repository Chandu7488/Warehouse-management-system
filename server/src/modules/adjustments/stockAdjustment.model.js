/**
 * StockPilot WMS - Stock Adjustment & Write-off Mongoose Model.
 *
 * Facilitates direct inventory write-offs (e.g. damaged, expired, scrap)
 * and manual discrepancies outside of scheduled cycle count orders.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const ADJUSTMENT_TYPES = Object.freeze({
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  WRITE_OFF: 'WRITE_OFF',
  DAMAGED_SCRAP: 'DAMAGED_SCRAP',
  FOUND_STOCK: 'FOUND_STOCK',
  CYCLE_COUNT_VARIANCE: 'CYCLE_COUNT_VARIANCE',
});

export const ADJUSTMENT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const stockAdjustmentItemSchema = new mongoose.Schema(
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
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => typeof v === 'number' && v !== 0,
        message: 'Adjustment quantity cannot be zero',
      },
    },
    unitCostMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalValueMinor: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        return ret;
      },
    },
  },
);

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ADJUSTMENT_TYPES),
      default: ADJUSTMENT_TYPES.MANUAL_ADJUSTMENT,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ADJUSTMENT_STATUSES),
      default: ADJUSTMENT_STATUSES.DRAFT,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
    },
    items: [stockAdjustmentItemSchema],
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    netQuantity: {
      type: Number,
      default: 0,
    },
    netValueMinor: {
      type: Number,
      default: 0,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
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
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        return ret;
      },
    },
  },
);

stockAdjustmentSchema.index({ warehouse: 1, status: 1 });
stockAdjustmentSchema.index({ createdAt: -1 });

export const StockAdjustment = mongoose.model(
  'StockAdjustment',
  stockAdjustmentSchema,
  'stockadjustments',
);
