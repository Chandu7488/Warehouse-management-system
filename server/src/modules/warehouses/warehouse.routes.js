/**
 * StockPilot WMS - Warehouse routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './warehouse.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  warehouseIdParamsSchema,
  createWarehouseBodySchema,
  updateWarehouseBodySchema,
  listWarehousesQuerySchema,
} from './warehouse.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listWarehousesQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_READ),
  controller.list,
);

router.post(
  '/',
  validate({ body: createWarehouseBodySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  controller.create,
);

router.get(
  '/:id',
  validate({ params: warehouseIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_READ),
  controller.getOne,
);

router.patch(
  '/:id',
  validate({ params: warehouseIdParamsSchema, body: updateWarehouseBodySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  controller.update,
);

router.delete(
  '/:id',
  validate({ params: warehouseIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  controller.deactivate,
);

export default router;
