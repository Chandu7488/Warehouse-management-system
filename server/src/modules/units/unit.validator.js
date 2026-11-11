/**
 * StockPilot WMS - Unit request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const unitIdParamsSchema = z.object({ id: objectId });

export const createUnitBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(1).max(50),
  allowDecimals: z.boolean().optional().default(false),
});

export const updateUnitBodySchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    allowDecimals: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided',
  });

export const listUnitsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z.string().trim().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
