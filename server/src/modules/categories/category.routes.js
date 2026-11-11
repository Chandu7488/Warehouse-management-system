/**
 * StockPilot WMS - Category routes.
 *
 * Authentication and permission middleware is added in Phase 2.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './category.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  categoryIdParamsSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from './category.validator.js';

const router = Router();

router.get(
  '/',
  validate({ query: listCategoriesQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.list,
);
router.post(
  '/',
  validate({ body: createCategoryBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.create,
);
router.get(
  '/:id',
  validate({ params: categoryIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_READ),
  controller.getOne,
);
router.patch(
  '/:id',
  validate({ params: categoryIdParamsSchema, body: updateCategoryBodySchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.update,
);
router.delete(
  '/:id',
  validate({ params: categoryIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.MASTER_WRITE),
  controller.deactivate,
);

export default router;
