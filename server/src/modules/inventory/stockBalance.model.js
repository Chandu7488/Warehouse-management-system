/**
 * StockPilot WMS - Stock Balance Mongoose model.
 *
 * Current stock levels per product, warehouse, location, and batch.
 * Mutated exclusively by the Stock Posting Service to ensure consistency.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

const stockBalanceSchema = new mongoose.Schema(
  {
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
      index: true,
    },
    onHand: {
      type: Number,
      required: true,
      default: 0,
    },
    reserved: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Reserved stock cannot be negative'],
    },
    lastMovementAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

stockBalanceSchema.virtual('available').get(function () {
  return Math.max(0, (this.onHand || 0) - (this.reserved || 0));
});

stockBalanceSchema.index({ product: 1, warehouse: 1, location: 1, batch: 1 }, { unique: true });

stockBalanceSchema.index({ warehouse: 1, onHand: 1 });
stockBalanceSchema.index({ product: 1, onHand: 1 });

export const StockBalance = mongoose.model('StockBalance', stockBalanceSchema, 'stockbalances');
