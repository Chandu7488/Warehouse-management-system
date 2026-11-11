/**
 * StockPilot WMS - Return Order / RMA Zod Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import {
  RETURN_TYPES,
  RMA_STATUSES,
  ITEM_CONDITIONS,
  DISPOSITION_TYPES,
  RETURN_REASONS,
} from './returnOrder.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const returnItemInputSchema = z.object({
  product: objectId,
  expectedQty: z.number().positive('Expected quantity must be greater than zero'),
  condition: z.enum(Object.values(ITEM_CONDITIONS)).optional().default(ITEM_CONDITIONS.NEW),
  reason: z.enum(Object.values(RETURN_REASONS)).optional().default(RETURN_REASONS.OTHER),
  reasonNotes: z.string().trim().max(500).optional().default(''),
  batch: objectId.optional().nullable(),
  serialNumbers: z.array(z.string().trim().min(1)).optional().default([]),
});

export const createReturnOrderSchema = z
  .object({
    returnType: z.enum(Object.values(RETURN_TYPES)).default(RETURN_TYPES.CUSTOMER_RETURN),
    warehouse: objectId,
    customer: objectId.optional().nullable(),
    supplier: objectId.optional().nullable(),
    salesOrder: objectId.optional().nullable(),
    purchaseOrder: objectId.optional().nullable(),
    trackingNumber: z.string().trim().max(100).optional().default(''),
    notes: z.string().trim().max(1000).optional().default(''),
    items: z.array(returnItemInputSchema).min(1, 'Return order must contain at least one line item'),
  })
  .refine(
    (data) => {
      if (data.returnType === RETURN_TYPES.CUSTOMER_RETURN && !data.customer && !data.salesOrder) {
        return false;
      }
      if (data.returnType === RETURN_TYPES.SUPPLIER_RETURN && !data.supplier && !data.purchaseOrder) {
        return false;
      }
      return true;
    },
    {
      message:
        'Customer returns require a customer or sales order; supplier returns require a supplier or purchase order',
    },
  );

export const receiveReturnOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: objectId,
        receivedQty: z.number().nonnegative('Received quantity cannot be negative'),
      }),
    )
    .min(1, 'At least one item line must be received'),
});

export const dispositionItemSchema = z.object({
  itemId: objectId,
  disposition: z.enum([
    DISPOSITION_TYPES.RESTOCK,
    DISPOSITION_TYPES.SCRAP,
    DISPOSITION_TYPES.QUARANTINE,
    DISPOSITION_TYPES.RETURN_TO_VENDOR,
  ]),
  condition: z.enum(Object.values(ITEM_CONDITIONS)).optional(),
  targetLocationId: objectId.optional().nullable(),
  inspectedQty: z.number().positive('Inspected quantity must be positive').optional(),
  notes: z.string().trim().max(500).optional().default(''),
});

export const processDispositionSchema = z.object({
  items: z.array(dispositionItemSchema).min(1, 'At least one item disposition must be specified'),
});

export const listReturnOrdersQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  returnType: z.enum(Object.values(RETURN_TYPES)).optional(),
  status: z.enum(Object.values(RMA_STATUSES)).optional(),
  customer: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
