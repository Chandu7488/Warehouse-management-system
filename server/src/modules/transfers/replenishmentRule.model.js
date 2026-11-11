/**
 * StockPilot WMS - Min/Max Replenishment Rule Mongoose model.
 *
 * Configures minimum depletion thresholds and maximum capacity limits
 * for picking-face bins to drive automated replenishment waves.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

const replenishmentRuleSchema = new mongoose.Schema(
  {
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: true,
      index: true,
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
    minQuantity: {
      type: Number,
      required: true,
      min: [0, 'Minimum quantity threshold cannot be negative'],
    },
    maxQuantity: {
      type: Number,
      required: true,
      validate: {
        validator: function (v) {
          const min =
            this.minQuantity ??
            this.getUpdate?.()?.minQuantity ??
            this.getUpdate?.()?.$set?.minQuantity;
          return min !== undefined ? v > min : true;
        },
        message: 'Maximum quantity must be strictly greater than minimum quantity',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

replenishmentRuleSchema.index(
  { warehouse: 1, product: 1, location: 1 },
  { unique: true },
);

export const ReplenishmentRule = mongoose.model(
  'ReplenishmentRule',
  replenishmentRuleSchema,
  'replenishmentrules',
);
