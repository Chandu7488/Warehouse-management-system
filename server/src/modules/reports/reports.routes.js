/**
 * StockPilot WMS - Analytics & Reports Express Routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  dashboardQuerySchema,
  valuationReportQuerySchema,
  turnoverReportQuerySchema,
  agingReportQuerySchema,
  discrepancyReportQuerySchema,
  exportReportParamsSchema,
} from './reports.validator.js';
import {
  getDashboardAnalyticsHandler,
  getInventoryValuationReportHandler,
  getInventoryTurnoverReportHandler,
  getBatchAgingReportHandler,
  getDiscrepancyReportHandler,
  exportReportToCsvHandler,
} from './reports.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize(PERMISSIONS.REPORTS_READ));

router.get(
  '/dashboard',
  validate({ query: dashboardQuerySchema }),
  getDashboardAnalyticsHandler,
);

router.get(
  '/inventory-valuation',
  validate({ query: valuationReportQuerySchema }),
  getInventoryValuationReportHandler,
);

router.get(
  '/turnover',
  validate({ query: turnoverReportQuerySchema }),
  getInventoryTurnoverReportHandler,
);

router.get(
  '/aging',
  validate({ query: agingReportQuerySchema }),
  getBatchAgingReportHandler,
);

router.get(
  '/discrepancies',
  validate({ query: discrepancyReportQuerySchema }),
  getDiscrepancyReportHandler,
);

router.get(
  '/export/:reportType',
  validate({ params: exportReportParamsSchema }),
  exportReportToCsvHandler,
);

export default router;
