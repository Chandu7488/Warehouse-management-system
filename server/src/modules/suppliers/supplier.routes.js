/**
 * StockPilot WMS - Supplier partner routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './supplier.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  supplierIdParamsSchema,
  createSupplierBodySchema,
  updateSupplierBodySchema,
  listSuppliersQuerySchema,
} from './supplier.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listSuppliersQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_READ),
  controller.list,
);

router.post(
  '/',
  validate({ body: createSupplierBodySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.create,
);

router.get(
  '/:id',
  validate({ params: supplierIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_READ),
  controller.getOne,
);

router.patch(
  '/:id',
  validate({ params: supplierIdParamsSchema, body: updateSupplierBodySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.update,
);

router.delete(
  '/:id',
  validate({ params: supplierIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.deactivate,
);

export default router;
