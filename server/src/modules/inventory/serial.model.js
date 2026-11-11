/**
 * StockPilot WMS - Serial Number Mongoose model.
 *
 * Tracks individual serialization for high-value items, appliances, and electronics.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const SERIAL_STATUSES = Object.freeze({
  IN_STOCK: 'IN_STOCK',
  RESERVED: 'RESERVED',
  SHIPPED: 'SHIPPED',
  RETURNED: 'RETURNED',
  SCRAPPED: 'SCRAPPED',
});

const serialSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    serialNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(SERIAL_STATUSES),
      default: SERIAL_STATUSES.IN_STOCK,
      index: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
      index: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

serialSchema.index({ product: 1, serialNumber: 1 }, { unique: true });
serialSchema.index({ warehouse: 1, location: 1 });

export const Serial = mongoose.model('Serial', serialSchema, 'serials');
