/**
 * StockPilot WMS - Purchase Order Zod Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { PO_STATUSES } from './purchaseOrder.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const poItemSchema = z.object({
  product: objectId,
  orderedQty: z.number().positive('Ordered quantity must be greater than zero'),
  unitPriceMinor: z.number().int().nonnegative('Unit price cannot be negative').default(0),
});

export const createPurchaseOrderSchema = z.object({
  supplier: objectId,
  warehouse: objectId,
  expectedDeliveryDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
  notes: z.string().trim().max(1000).optional().default(''),
  items: z.array(poItemSchema).min(1, 'Purchase order must have at least one line item'),
});

export const updatePurchaseOrderSchema = z
  .object({
    supplier: objectId.optional(),
    warehouse: objectId.optional(),
    expectedDeliveryDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
    notes: z.string().trim().max(1000).optional(),
    items: z.array(poItemSchema).min(1).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listPurchaseOrdersQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  status: z.enum(Object.values(PO_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
