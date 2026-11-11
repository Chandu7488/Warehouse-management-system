/**
 * StockPilot WMS - Stock Ledger Entry Mongoose model.
 *
 * Append-only immutable ledger recording every physical movement of stock.
 * Prohibits updates and deletions via schema middleware to ensure strict
 * regulatory and accounting traceability.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { ApiError } from '../../utils/ApiError.js';

export const MOVEMENT_TYPES = Object.freeze({
  OPENING_BALANCE: 'OPENING_BALANCE',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  PUTAWAY: 'PUTAWAY',
  SALES_ISSUE: 'SALES_ISSUE',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  ADJUSTMENT_GAIN: 'ADJUSTMENT_GAIN',
  ADJUSTMENT_LOSS: 'ADJUSTMENT_LOSS',
  CUSTOMER_RETURN: 'CUSTOMER_RETURN',
  SUPPLIER_RETURN: 'SUPPLIER_RETURN',
  WRITE_OFF: 'WRITE_OFF',
  REVERSAL: 'REVERSAL',
});

const stockLedgerEntrySchema = new mongoose.Schema(
  {
    transactionGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      default: () => new mongoose.Types.ObjectId(),
      index: true,
    },
    postingDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    movementType: {
      type: String,
      required: true,
      enum: Object.values(MOVEMENT_TYPES),
      index: true,
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
    serial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Serial',
      default: null,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (v) => typeof v === 'number' && v !== 0,
        message: 'Movement quantity must be a non-zero signed number',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    unitCostMinor: {
      type: Number,
      default: 0,
    },
    valueChangeMinor: {
      type: Number,
      default: 0,
    },
    referenceType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    referenceNo: {
      type: String,
      trim: true,
      default: null,
    },
    lineId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockLedgerEntry',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

stockLedgerEntrySchema.index({ product: 1, warehouse: 1, postingDate: -1 });
stockLedgerEntrySchema.index({ referenceType: 1, referenceId: 1 });
stockLedgerEntrySchema.index(
  {
    referenceType: 1,
    referenceId: 1,
    lineId: 1,
    movementType: 1,
    location: 1,
    batch: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

const blockMutation = function () {
  throw ApiError.forbidden(
    'Stock ledger entries are immutable (append-only) and cannot be updated or deleted',
  );
};

stockLedgerEntrySchema.pre('updateOne', blockMutation);
stockLedgerEntrySchema.pre('updateMany', blockMutation);
stockLedgerEntrySchema.pre('findOneAndUpdate', blockMutation);
stockLedgerEntrySchema.pre('replaceOne', blockMutation);
stockLedgerEntrySchema.pre('deleteOne', blockMutation);
stockLedgerEntrySchema.pre('deleteMany', blockMutation);
stockLedgerEntrySchema.pre('findOneAndDelete', blockMutation);
stockLedgerEntrySchema.pre('findOneAndReplace', blockMutation);

export const StockLedgerEntry = mongoose.model(
  'StockLedgerEntry',
  stockLedgerEntrySchema,
  'stockledgerentries',
);
