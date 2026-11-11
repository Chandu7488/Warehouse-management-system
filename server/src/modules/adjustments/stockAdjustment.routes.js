/**
 * StockPilot WMS - Stock Adjustment Express Routes.
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
  adjustmentIdParamsSchema,
  createAdjustmentSchema,
  approveAdjustmentSchema,
  listAdjustmentsQuerySchema,
} from './stockAdjustment.validator.js';
import {
  createAdjustmentHandler,
  approveAdjustmentHandler,
  rejectAdjustmentHandler,
  getAdjustmentByIdHandler,
  listAdjustmentsHandler,
} from './stockAdjustment.controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(PERMISSIONS.ADJUSTMENTS_WRITE),
  validate({ body: createAdjustmentSchema }),
  createAdjustmentHandler,
);

router.get(
  '/',
  authorize(PERMISSIONS.ADJUSTMENTS_READ),
  validate({ query: listAdjustmentsQuerySchema }),
  listAdjustmentsHandler,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.ADJUSTMENTS_READ),
  validate({ params: adjustmentIdParamsSchema }),
  getAdjustmentByIdHandler,
);

router.post(
  '/:id/approve',
  authorize(PERMISSIONS.ADJUSTMENTS_APPROVE),
  validate({ params: adjustmentIdParamsSchema, body: approveAdjustmentSchema }),
  approveAdjustmentHandler,
);

router.post(
  '/:id/reject',
  authorize(PERMISSIONS.ADJUSTMENTS_APPROVE),
  validate({ params: adjustmentIdParamsSchema }),
  rejectAdjustmentHandler,
);

export default router;
