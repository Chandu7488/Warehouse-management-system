/**
 * StockPilot WMS - Analytics & Reports Validation Schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier format');

export const dashboardQuerySchema = z.object({
  warehouse: objectId.optional(),
});

export const valuationReportQuerySchema = z.object({
  warehouse: objectId.optional(),
  category: objectId.optional(),
});

export const turnoverReportQuerySchema = z.object({
  warehouse: objectId.optional(),
  timeWindowDays: z.coerce.number().int().min(7).max(365).default(90),
});

export const agingReportQuerySchema = z.object({
  warehouse: objectId.optional(),
});

export const discrepancyReportQuerySchema = z.object({
  warehouse: objectId.optional(),
  startDate: z.string().datetime({ offset: true }).optional(),
  endDate: z.string().datetime({ offset: true }).optional(),
});

export const exportReportParamsSchema = z.object({
  reportType: z.enum(['valuation', 'turnover', 'aging', 'discrepancies']),
});
