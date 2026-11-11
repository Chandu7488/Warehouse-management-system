/**
 * StockPilot WMS - Product model.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const TRACKING_TYPES = Object.freeze({
  NONE: 'NONE',
  BATCH: 'BATCH',
  SERIAL: 'SERIAL',
});

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 50,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      required: true,
      index: true,
    },
    trackingType: {
      type: String,
      enum: Object.values(TRACKING_TYPES),
      default: TRACKING_TYPES.NONE,
    },
    hasExpiry: {
      type: Boolean,
      default: false,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    reorderQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPriceMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    salePriceMinor: {
      type: Number,
      default: 0,
      min: 0,
    },
    weightKg: {
      type: Number,
      default: null,
      min: 0,
    },
    dimensionsCm: {
      length: { type: Number, default: null, min: 0 },
      width: { type: Number, default: null, min: 0 },
      height: { type: Number, default: null, min: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      versionKey: false,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

productSchema.index({ barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ name: 'text' });

export const Product = mongoose.model('Product', productSchema);
