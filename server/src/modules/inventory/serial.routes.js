/**
 * StockPilot WMS - Serial Number Routes.
 *
 * Exposes endpoints for serial numbers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './serial.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import { listSerialsQuerySchema, createSerialSchema } from './serial.validator.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  validate({ query: listSerialsQuerySchema }),
  controller.listSerialsHandler,
);

router.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_WRITE),
  validate({ body: createSerialSchema }),
  controller.createSerialHandler,
);

router.get(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  controller.getSerialByIdHandler,
);

export default router;
