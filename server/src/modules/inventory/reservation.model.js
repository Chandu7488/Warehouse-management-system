/**
 * StockPilot WMS - Stock Reservation Mongoose model.
 *
 * Records allocations reserved for outbound orders against specific locations and batches.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';

export const RESERVATION_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PICKED: 'PICKED',
  CONSUMED: 'CONSUMED',
  RELEASED: 'RELEASED',
});

const reservationSchema = new mongoose.Schema(
  {
    salesOrder: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    lineId: {
      type: mongoose.Schema.Types.Mixed,
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
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Reserved quantity must be positive'],
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(RESERVATION_STATUSES),
      default: RESERVATION_STATUSES.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

reservationSchema.index({ product: 1, warehouse: 1, status: 1 });

export const Reservation = mongoose.model('Reservation', reservationSchema, 'reservations');
