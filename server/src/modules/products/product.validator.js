/**
 * StockPilot WMS - Product request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { TRACKING_TYPES } from './product.model.js';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const decimalQuantity = z.coerce
  .number()
  .min(0, 'Quantity cannot be negative')
  .refine(
    (val) => {
      const parts = val.toString().split('.');
      return parts.length < 2 || parts[1].length <= 3;
    },
    { message: 'Quantity cannot have more than 3 decimal places' },
  );

export const productIdParamsSchema = z.object({ id: objectId });

export const createProductBodySchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional().default(''),
    category: objectId,
    unit: objectId,
    trackingType: z.enum(Object.values(TRACKING_TYPES)).optional().default(TRACKING_TYPES.NONE),
    hasExpiry: z.boolean().optional().default(false),
    barcode: z.string().trim().nullable().optional(),
    reorderLevel: decimalQuantity.optional().default(0),
    reorderQuantity: decimalQuantity.optional().default(0),
    costPriceMinor: z.coerce.number().int().min(0).optional().default(0),
    salePriceMinor: z.coerce.number().int().min(0).optional().default(0),
    weightKg: z.coerce.number().min(0).nullable().optional(),
    dimensionsCm: z
      .object({
        length: z.coerce.number().min(0).nullable().optional(),
        width: z.coerce.number().min(0).nullable().optional(),
        height: z.coerce.number().min(0).nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.hasExpiry && data.trackingType !== TRACKING_TYPES.BATCH) {
        return false;
      }
      return true;
    },
    {
      message: 'Expiry tracking is only allowed for products with BATCH tracking',
      path: ['hasExpiry'],
    },
  );

export const updateProductBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    category: objectId.optional(),
    unit: objectId.optional(),
    trackingType: z.enum(Object.values(TRACKING_TYPES)).optional(),
    hasExpiry: z.boolean().optional(),
    barcode: z.string().trim().nullable().optional(),
    reorderLevel: decimalQuantity.optional(),
    reorderQuantity: decimalQuantity.optional(),
    costPriceMinor: z.coerce.number().int().min(0).optional(),
    salePriceMinor: z.coerce.number().int().min(0).optional(),
    weightKg: z.coerce.number().min(0).nullable().optional(),
    dimensionsCm: z
      .object({
        length: z.coerce.number().min(0).nullable().optional(),
        width: z.coerce.number().min(0).nullable().optional(),
        height: z.coerce.number().min(0).nullable().optional(),
      })
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided',
  })
  .refine(
    (data) => {
      if (
        data.hasExpiry === true &&
        data.trackingType &&
        data.trackingType !== TRACKING_TYPES.BATCH
      ) {
        return false;
      }
      return true;
    },
    {
      message: 'Expiry tracking is only allowed for products with BATCH tracking',
      path: ['hasExpiry'],
    },
  );

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z.string().trim().max(100).optional(),
  category: objectId.optional(),
  unit: objectId.optional(),
  trackingType: z.enum(Object.values(TRACKING_TYPES)).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const lookupProductQuerySchema = z.object({
  code: z.string().trim().min(1, 'Barcode or SKU code is required'),
});
