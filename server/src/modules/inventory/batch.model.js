/**
 * StockPilot WMS - Batch / Lot Mongoose model.
 *
 * Represents lots or manufacturing batches with optional expiration and supplier linkage.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const BATCH_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  QUARANTINED: 'QUARANTINED',
  EXPIRED: 'EXPIRED',
  RECALLED: 'RECALLED',
});

const batchSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    batchNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    manufacturedOn: {
      type: Date,
      default: null,
    },
    expiresOn: {
      type: Date,
      default: null,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(BATCH_STATUSES),
      default: BATCH_STATUSES.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

batchSchema.index({ product: 1, batchNumber: 1 }, { unique: true });

export const Batch = mongoose.model('Batch', batchSchema, 'batches');
