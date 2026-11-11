/**
 * StockPilot WMS - Serial Number Zod Validation Schemas.
 *
 * Validates serial number creation and query filters.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { SERIAL_STATUSES } from './serial.model.js';

export const listSerialsQuerySchema = z.object({
  product: z.string().trim().optional(),
  status: z.enum(Object.values(SERIAL_STATUSES)).optional(),
  warehouse: z.string().trim().optional(),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createSerialSchema = z.object({
  product: z.string().trim().min(1, 'Product ID is required'),
  serialNumber: z.string().trim().min(1, 'Serial number is required'),
  warehouse: z.string().trim().optional(),
  location: z.string().trim().optional(),
  batch: z.string().trim().optional(),
});
