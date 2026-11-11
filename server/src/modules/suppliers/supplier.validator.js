/**
 * StockPilot WMS - Supplier request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const addressSchema = z.object({
  line1: z.string().trim().max(100).optional().default(''),
  line2: z.string().trim().max(100).optional().default(''),
  city: z.string().trim().max(50).optional().default(''),
  state: z.string().trim().max(50).optional().default(''),
  postalCode: z.string().trim().max(20).optional().default(''),
  country: z.string().trim().max(50).optional().default(''),
});

export const supplierIdParamsSchema = z.object({ id: objectId });

export const createSupplierBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email('Invalid email address').or(z.literal('')).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  address: addressSchema.optional().default(() => ({})),
  paymentTermsDays: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const updateSupplierBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    email: z.string().trim().email('Invalid email address').or(z.literal('')).optional(),
    phone: z.string().trim().max(30).optional(),
    address: addressSchema.optional(),
    paymentTermsDays: z.coerce.number().int().min(0).optional(),
    notes: z.string().trim().max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided',
  });

export const listSuppliersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z.string().trim().max(100).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});
