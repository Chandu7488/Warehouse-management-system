/**
 * StockPilot WMS - Location Mongoose model.
 *
 * Defines hierarchical physical warehouse locations (Zones, Racks, Shelves, Bins)
 * structured with materialized paths and functional storage purposes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const LOCATION_TYPES = Object.freeze({
  ZONE: 'ZONE',
  RACK: 'RACK',
  SHELF: 'SHELF',
  BIN: 'BIN',
});

export const LOCATION_PURPOSES = Object.freeze({
  RECEIVING: 'RECEIVING',
  QUARANTINE: 'QUARANTINE',
  STORAGE: 'STORAGE',
  PICKING: 'PICKING',
  SHIPPING: 'SHIPPING',
  DAMAGED: 'DAMAGED',
  RETURNS: 'RETURNS',
});

const capacitySchema = new mongoose.Schema(
  {
    maxQuantity: {
      type: Number,
      min: 0,
      default: null,
    },
    maxWeightKg: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { _id: false },
);

const locationSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(LOCATION_TYPES),
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(LOCATION_PURPOSES),
      default: LOCATION_PURPOSES.STORAGE,
      required: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    capacity: {
      type: capacitySchema,
      default: null,
    },
    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

locationSchema.index({ warehouse: 1, code: 1 }, { unique: true });
locationSchema.index({ warehouse: 1, type: 1, purpose: 1 });
locationSchema.index({ warehouse: 1, path: 1 });

export const Location = mongoose.model('Location', locationSchema);
