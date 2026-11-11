/**
 * StockPilot WMS - Batch Routes.
 *
 * Exposes endpoints for managing lots and batches.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './batch.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  listBatchesQuerySchema,
  createBatchSchema,
  updateBatchStatusSchema,
} from './batch.validator.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  validate({ query: listBatchesQuerySchema }),
  controller.listBatchesHandler,
);

router.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_WRITE),
  validate({ body: createBatchSchema }),
  controller.createBatchHandler,
);

router.get(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  controller.getBatchByIdHandler,
);

router.patch(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_WRITE),
  validate({ body: updateBatchStatusSchema }),
  controller.updateBatchStatusHandler,
);

export default router;
