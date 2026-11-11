/**
 * StockPilot WMS - Inventory Zod Validation Schemas.
 *
 * Enforces schemas for stock balance filtering, ledger history queries,
 * stock availability requests, opening balance submissions, and entry reversals.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { MOVEMENT_TYPES } from './stockLedgerEntry.model.js';

export const listBalancesQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  product: z.string().trim().optional(),
  location: z.string().trim().optional(),
  category: z.string().trim().optional(),
  inStockOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listLedgerQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  product: z.string().trim().optional(),
  location: z.string().trim().optional(),
  movementType: z.enum(Object.values(MOVEMENT_TYPES)).optional(),
  referenceType: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const availabilityQuerySchema = z.object({
  warehouse: z.string().trim().min(1, 'Warehouse ID is required'),
  product: z.string().trim().min(1, 'Product ID is required'),
});

const openingBalanceItemSchema = z.object({
  product: z.string().trim().min(1, 'Product ID is required'),
  location: z.string().trim().min(1, 'Location ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  batchNumber: z.string().trim().optional(),
  expiresOn: z.string().trim().optional(),
  unitCostMinor: z.number().int().nonnegative().optional(),
  reason: z.string().trim().optional(),
});

export const openingBalanceSchema = z.object({
  warehouse: z.string().trim().min(1, 'Warehouse ID is required'),
  items: z.array(openingBalanceItemSchema).min(1, 'At least one item is required'),
});

export const reverseLedgerSchema = z.object({
  reason: z.string().trim().min(3, 'A clear reason of at least 3 characters is required'),
});
