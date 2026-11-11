/**
 * StockPilot WMS - Unit of measure routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './unit.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  unitIdParamsSchema,
  createUnitBodySchema,
  listUnitsQuerySchema,
  updateUnitBodySchema,
} from './unit.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listUnitsQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.list,
);

router.post(
  '/',
  validate({ body: createUnitBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.create,
);

router.get(
  '/:id',
  validate({ params: unitIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.getOne,
);

router.patch(
  '/:id',
  validate({ params: unitIdParamsSchema, body: updateUnitBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.update,
);

router.delete(
  '/:id',
  validate({ params: unitIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.deactivate,
);

export default router;
