/**
 * StockPilot WMS - Inbound Operations Zod Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { GRN_STATUSES } from './goodsReceipt.model.js';
import { PUTAWAY_STATUSES } from './putawayTask.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const grnItemSchema = z.object({
  product: objectId,
  purchaseOrderLineId: objectId.optional().nullable(),
  receivedQty: z.number().positive('Received quantity must be greater than zero'),
  unitCostMinor: z.number().int().nonnegative().optional().default(0),
  batchNumber: z.string().trim().optional(),
  expiresOn: z.string().optional(),
  serialNumbers: z.array(z.string().trim().min(1)).optional().default([]),
});

export const createGoodsReceiptSchema = z.object({
  purchaseOrder: objectId.optional().nullable(),
  supplier: objectId,
  warehouse: objectId,
  receivingLocation: objectId.optional(),
  vendorInvoiceNo: z.string().trim().max(100).optional(),
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional().default(''),
  items: z.array(grnItemSchema).min(1, 'At least one item must be received'),
});

const inspectItemSchema = z.object({
  itemId: objectId,
  acceptedQty: z.number().min(0, 'Accepted quantity cannot be negative'),
  rejectedQty: z.number().min(0, 'Rejected quantity cannot be negative'),
  rejectionReason: z.string().trim().optional(),
  quarantineLocationId: objectId.optional(),
});

export const inspectGoodsReceiptSchema = z.object({
  items: z.array(inspectItemSchema).min(1, 'At least one inspection result is required'),
});

export const listGoodsReceiptsQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  purchaseOrder: z.string().trim().optional(),
  status: z.enum(Object.values(GRN_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listPutawayTasksQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  product: z.string().trim().optional(),
  status: z.enum(Object.values(PUTAWAY_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const completePutawayTaskSchema = z.object({
  destinationLocation: objectId,
  notes: z.string().trim().max(1000).optional(),
});

export const suggestLocationQuerySchema = z.object({
  warehouse: objectId,
  product: objectId,
  batch: objectId.optional(),
});
