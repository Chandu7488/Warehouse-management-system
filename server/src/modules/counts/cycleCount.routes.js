/**
 * StockPilot WMS - Cycle Count Express Routes.
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
  cycleCountIdParamsSchema,
  createCycleCountSchema,
  submitCountSheetSchema,
  requestRecountSchema,
  reconcileCountSchema,
  listCycleCountsQuerySchema,
} from './cycleCount.validator.js';
import {
  createCycleCountHandler,
  startCycleCountHandler,
  submitCountResultsHandler,
  requestRecountHandler,
  reconcileCycleCountHandler,
  cancelCycleCountHandler,
  getCycleCountByIdHandler,
  listCycleCountsHandler,
} from './cycleCount.controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize(PERMISSIONS.COUNTS_WRITE),
  validate({ body: createCycleCountSchema }),
  createCycleCountHandler,
);

router.get(
  '/',
  authorize(PERMISSIONS.COUNTS_READ),
  validate({ query: listCycleCountsQuerySchema }),
  listCycleCountsHandler,
);

router.get(
  '/:id',
  authorize(PERMISSIONS.COUNTS_READ),
  validate({ params: cycleCountIdParamsSchema }),
  getCycleCountByIdHandler,
);

router.post(
  '/:id/start',
  authorize(PERMISSIONS.COUNTS_WRITE),
  validate({ params: cycleCountIdParamsSchema }),
  startCycleCountHandler,
);

router.post(
  '/:id/submit',
  authorize(PERMISSIONS.COUNTS_WRITE),
  validate({ params: cycleCountIdParamsSchema, body: submitCountSheetSchema }),
  submitCountResultsHandler,
);

router.post(
  '/:id/recount',
  authorize(PERMISSIONS.COUNTS_WRITE, PERMISSIONS.COUNTS_APPROVE),
  validate({ params: cycleCountIdParamsSchema, body: requestRecountSchema }),
  requestRecountHandler,
);

router.post(
  '/:id/reconcile',
  authorize(PERMISSIONS.COUNTS_APPROVE),
  validate({ params: cycleCountIdParamsSchema, body: reconcileCountSchema }),
  reconcileCycleCountHandler,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.COUNTS_WRITE),
  validate({ params: cycleCountIdParamsSchema }),
  cancelCycleCountHandler,
);

export default router;
