/**
 * StockPilot WMS - Location request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { LOCATION_TYPES, LOCATION_PURPOSES } from './location.model.js';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const capacitySchema = z
  .object({
    maxQuantity: z.coerce.number().min(0, 'Quantity cannot be negative').nullable().optional(),
    maxWeightKg: z.coerce.number().min(0, 'Weight cannot be negative').nullable().optional(),
  })
  .optional()
  .nullable();

export const locationIdParamsSchema = z.object({ id: objectId });

export const createLocationBodySchema = z.object({
  warehouse: objectId,
  parent: objectId.nullable().optional(),
  type: z.enum(Object.values(LOCATION_TYPES)),
  purpose: z.enum(Object.values(LOCATION_PURPOSES)).optional().default(LOCATION_PURPOSES.STORAGE),
  code: z
    .string()
    .trim()
    .min(1, 'Code must be at least 1 character')
    .max(50, 'Code cannot exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  capacity: capacitySchema,
  allowedCategories: z.array(objectId).optional().default([]),
});

export const updateLocationBodySchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .transform((val) => val.toUpperCase())
      .optional(),
    parent: objectId.nullable().optional(),
    purpose: z.enum(Object.values(LOCATION_PURPOSES)).optional(),
    capacity: capacitySchema,
    allowedCategories: z.array(objectId).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided',
  });

export const bulkCreateLocationsBodySchema = z.object({
  warehouse: objectId,
  zone: objectId,
  rackCode: z
    .string()
    .trim()
    .min(1, 'Rack code must be at least 1 character')
    .max(20, 'Rack code cannot exceed 20 characters')
    .transform((val) => val.toUpperCase()),
  purpose: z.enum(Object.values(LOCATION_PURPOSES)).optional().default(LOCATION_PURPOSES.STORAGE),
  shelvesCount: z.coerce.number().int().min(1).max(50),
  binsPerShelf: z.coerce.number().int().min(1).max(50),
});

export const listLocationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  warehouse: objectId.optional(),
  type: z.enum(Object.values(LOCATION_TYPES)).optional(),
  purpose: z.enum(Object.values(LOCATION_PURPOSES)).optional(),
  parent: objectId.nullable().optional(),
  search: z.string().trim().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const treeLocationsQuerySchema = z.object({
  warehouse: objectId,
});
