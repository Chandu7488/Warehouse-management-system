/**
 * StockPilot WMS - Transfers & Replenishment Zod Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { TRANSFER_TYPES, TRANSFER_STATUSES } from './transferOrder.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const directBinTransferSchema = z
  .object({
    warehouse: objectId,
    product: objectId,
    sourceLocation: objectId,
    destinationLocation: objectId,
    quantity: z.number().positive('Transfer quantity must be greater than zero'),
    batch: objectId.optional().nullable(),
    serials: z.array(objectId).optional().default([]),
    notes: z.string().trim().max(500).optional().default(''),
  })
  .refine((data) => data.sourceLocation !== data.destinationLocation, {
    message: 'Source bin and destination bin must be distinct locations',
  });

const transferItemInputSchema = z.object({
  product: objectId,
  requestedQty: z.number().positive('Requested transfer quantity must be greater than zero'),
  sourceLocation: objectId,
  destinationLocation: objectId.optional().nullable(),
  batch: objectId.optional().nullable(),
  serials: z.array(objectId).optional().default([]),
});

export const createTransferOrderSchema = z
  .object({
    transferType: z.enum(Object.values(TRANSFER_TYPES)).default(TRANSFER_TYPES.INTER_WAREHOUSE),
    originWarehouse: objectId,
    destinationWarehouse: objectId,
    carrier: z.string().trim().max(100).optional().default(''),
    trackingNumber: z.string().trim().max(100).optional().default(''),
    notes: z.string().trim().max(1000).optional().default(''),
    items: z.array(transferItemInputSchema).min(1, 'Transfer order must contain at least one line item'),
  })
  .refine(
    (data) => {
      if (data.transferType === TRANSFER_TYPES.INTER_WAREHOUSE) {
        return data.originWarehouse !== data.destinationWarehouse;
      }
      return data.originWarehouse === data.destinationWarehouse;
    },
    {
      message:
        'Inter-warehouse transfers require distinct origin and destination warehouses; intra-warehouse transfers must specify the same warehouse',
    },
  );

export const dispatchTransferOrderSchema = z.object({
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: objectId,
        dispatchedQty: z.number().positive('Dispatched quantity must be positive'),
      }),
    )
    .optional(),
});

export const receiveTransferOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: objectId,
        receivedQty: z.number().positive('Received quantity must be positive'),
        destinationLocationId: objectId,
      }),
    )
    .min(1, 'At least one item line must be received'),
});

export const replenishmentRuleInputSchema = z
  .object({
    warehouse: objectId,
    product: objectId,
    location: objectId,
    minQuantity: z.number().min(0, 'Minimum quantity cannot be negative'),
    maxQuantity: z.number().positive('Maximum capacity must be positive'),
    isActive: z.boolean().optional().default(true),
  })
  .refine((data) => data.maxQuantity > data.minQuantity, {
    message: 'Maximum capacity must be strictly greater than minimum threshold',
  });

export const listTransferOrdersQuerySchema = z.object({
  originWarehouse: z.string().trim().optional(),
  destinationWarehouse: z.string().trim().optional(),
  transferType: z.enum(Object.values(TRANSFER_TYPES)).optional(),
  status: z.enum(Object.values(TRANSFER_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
