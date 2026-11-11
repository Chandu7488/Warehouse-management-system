/**
 * StockPilot WMS - Batch Zod Validation Schemas.
 *
 * Validates batch creation, status transitions, and list query filters.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { BATCH_STATUSES } from './batch.model.js';

export const listBatchesQuerySchema = z.object({
  product: z.string().trim().optional(),
  status: z.enum(Object.values(BATCH_STATUSES)).optional(),
  supplier: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createBatchSchema = z.object({
  product: z.string().trim().min(1, 'Product ID is required'),
  batchNumber: z.string().trim().min(1, 'Batch number is required'),
  manufacturedOn: z.string().trim().optional(),
  expiresOn: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
});

export const updateBatchStatusSchema = z.object({
  status: z.enum(Object.values(BATCH_STATUSES)),
});
