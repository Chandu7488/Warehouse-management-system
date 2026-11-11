/**
 * StockPilot WMS - Stock Adjustment Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { ADJUSTMENT_TYPES, ADJUSTMENT_STATUSES } from './stockAdjustment.model.js';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier format');

export const adjustmentIdParamsSchema = z.object({
  id: objectId,
});

export const createAdjustmentSchema = z.object({
  warehouse: objectId,
  type: z.enum(Object.values(ADJUSTMENT_TYPES)).default(ADJUSTMENT_TYPES.MANUAL_ADJUSTMENT),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(300),
  notes: z.string().max(500).optional().default(''),
  items: z
    .array(
      z.object({
        product: objectId,
        location: objectId,
        batch: objectId.nullable().optional(),
        quantity: z.coerce
          .number()
          .refine((v) => v !== 0, 'Adjustment quantity cannot be zero'),
        reason: z.string().trim().min(1, 'Item adjustment reason is required'),
      }),
    )
    .min(1, 'At least one adjustment item is required'),
});

export const approveAdjustmentSchema = z.object({
  notes: z.string().max(500).optional().default(''),
});

export const listAdjustmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  warehouse: objectId.optional(),
  type: z.enum(Object.values(ADJUSTMENT_TYPES)).optional(),
  status: z.enum(Object.values(ADJUSTMENT_STATUSES)).optional(),
  search: z.string().trim().max(100).optional(),
});
