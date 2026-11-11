/**
 * StockPilot WMS - Customer partner routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './customer.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  customerIdParamsSchema,
  createCustomerBodySchema,
  updateCustomerBodySchema,
  listCustomersQuerySchema,
} from './customer.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listCustomersQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_READ),
  controller.list,
);

router.post(
  '/',
  validate({ body: createCustomerBodySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.create,
);

router.get(
  '/:id',
  validate({ params: customerIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_READ),
  controller.getOne,
);

router.patch(
  '/:id',
  validate({ params: customerIdParamsSchema, body: updateCustomerBodySchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.update,
);

router.delete(
  '/:id',
  validate({ params: customerIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.PARTNERS_WRITE),
  controller.deactivate,
);

export default router;
