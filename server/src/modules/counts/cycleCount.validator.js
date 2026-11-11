/**
 * StockPilot WMS - Cycle Count Request Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { COUNT_TYPES, COUNT_STATUSES } from './cycleCount.model.js';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier format');

export const cycleCountIdParamsSchema = z.object({
  id: objectId,
});

export const createCycleCountSchema = z.object({
  warehouse: objectId,
  type: z.enum(Object.values(COUNT_TYPES)).default(COUNT_TYPES.CYCLE_COUNT),
  blindCount: z.boolean().default(true),
  scope: z
    .object({
      locations: z.array(objectId).optional().default([]),
      categories: z.array(objectId).optional().default([]),
      products: z.array(objectId).optional().default([]),
    })
    .optional()
    .default({ locations: [], categories: [], products: [] }),
  assignedTo: objectId.nullable().optional(),
  notes: z.string().max(500).optional().default(''),
});

export const submitCountSheetSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: objectId,
        countedQty: z.coerce.number().min(0, 'Counted quantity cannot be negative'),
        notes: z.string().max(500).optional().default(''),
      }),
    )
    .min(1, 'At least one count entry must be submitted'),
});

export const requestRecountSchema = z.object({
  itemIds: z.array(objectId).min(1, 'Select at least one item to recount'),
  notes: z.string().max(500).optional().default(''),
});

export const reconcileCountSchema = z.object({
  notes: z.string().max(500).optional().default(''),
});

export const listCycleCountsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  warehouse: objectId.optional(),
  type: z.enum(Object.values(COUNT_TYPES)).optional(),
  status: z.enum(Object.values(COUNT_STATUSES)).optional(),
  search: z.string().trim().max(100).optional(),
});
