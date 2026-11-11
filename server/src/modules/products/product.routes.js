/**
 * StockPilot WMS - Product routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './product.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  productIdParamsSchema,
  createProductBodySchema,
  updateProductBodySchema,
  listProductsQuerySchema,
  lookupProductQuerySchema,
} from './product.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listProductsQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.list,
);

router.post(
  '/',
  validate({ body: createProductBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.create,
);

router.get(
  '/lookup',
  validate({ query: lookupProductQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.lookup,
);

router.get(
  '/:id',
  validate({ params: productIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.getOne,
);

router.patch(
  '/:id',
  validate({ params: productIdParamsSchema, body: updateProductBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.update,
);

router.delete(
  '/:id',
  validate({ params: productIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.deactivate,
);

router.get(
  '/:id/stock',
  validate({ params: productIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  controller.getStock,
);

export default router;
