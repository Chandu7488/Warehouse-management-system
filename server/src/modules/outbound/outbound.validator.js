/**
 * StockPilot WMS - Outbound Operations Zod Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { SO_STATUSES } from './salesOrder.model.js';
import { PICK_STATUSES } from './pickList.model.js';
import { SHIPMENT_STATUSES } from './shipment.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

const salesOrderItemInputSchema = z.object({
  product: objectId,
  orderedQty: z.number().positive('Ordered quantity must be greater than zero'),
  unitPriceMinor: z.number().int().nonnegative('Unit price cannot be negative'),
});

const addressSchema = z
  .object({
    street: z.string().trim().default(''),
    city: z.string().trim().default(''),
    state: z.string().trim().default(''),
    postalCode: z.string().trim().default(''),
    country: z.string().trim().default('US'),
  })
  .optional();

export const createSalesOrderSchema = z.object({
  customer: objectId,
  warehouse: objectId,
  items: z.array(salesOrderItemInputSchema).min(1, 'Sales order must contain at least one line item'),
  requestedDeliveryDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
  shippingAddress: addressSchema,
  taxMinor: z.number().int().nonnegative().optional().default(0),
  shippingMinor: z.number().int().nonnegative().optional().default(0),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const updateSalesOrderSchema = z
  .object({
    customer: objectId.optional(),
    warehouse: objectId.optional(),
    items: z.array(salesOrderItemInputSchema).min(1).optional(),
    requestedDeliveryDate: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(Date.parse(val)), 'Invalid date format'),
    shippingAddress: addressSchema,
    taxMinor: z.number().int().nonnegative().optional(),
    shippingMinor: z.number().int().nonnegative().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listSalesOrdersQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  customer: z.string().trim().optional(),
  status: z.enum(Object.values(SO_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPickListSchema = z.object({
  warehouse: objectId,
  salesOrderIds: z.array(objectId).min(1, 'At least one sales order must be selected for picking'),
  stagingLocationId: objectId.optional(),
  assignedTo: objectId.optional(),
});

export const confirmPickItemSchema = z.object({
  pickedQty: z.number().positive('Picked quantity must be greater than zero'),
  batch: objectId.optional().nullable(),
  serialNumbers: z.array(z.string().trim().min(1)).optional().default([]),
});

export const listPickListsQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  status: z.enum(Object.values(PICK_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createShipmentSchema = z.object({
  salesOrder: objectId,
  carrier: z.string().trim().max(100).optional().default(''),
  trackingNumber: z.string().trim().max(100).optional().default(''),
  packages: z
    .array(
      z.object({
        packageNumber: z.string().trim().min(1),
        weightKg: z.number().min(0).optional().default(0),
        boxType: z.string().trim().optional().default('STANDARD_BOX'),
      }),
    )
    .optional()
    .default([]),
  notes: z.string().trim().max(1000).optional().default(''),
});

export const dispatchShipmentSchema = z.object({
  carrier: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const listShipmentsQuerySchema = z.object({
  warehouse: z.string().trim().optional(),
  salesOrder: z.string().trim().optional(),
  status: z.enum(Object.values(SHIPMENT_STATUSES)).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
