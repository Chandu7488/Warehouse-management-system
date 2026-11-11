/**
 * StockPilot WMS - User management routes.
 *
 * Exposes endpoints for listing, creating, reading, and updating user records.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './user.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  userIdParamsSchema,
  createUserBodySchema,
  updateUserBodySchema,
  listUsersQuerySchema,
} from './user.validator.js';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(PERMISSIONS.USERS_READ),
  validate({ query: listUsersQuerySchema }),
  controller.list,
);

router.post(
  '/',
  authenticate,
  authorize(PERMISSIONS.USERS_WRITE),
  validate({ body: createUserBodySchema }),
  controller.create,
);

router.get(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.USERS_READ),
  validate({ params: userIdParamsSchema }),
  controller.getOne,
);

router.patch(
  '/:id',
  authenticate,
  authorize(PERMISSIONS.USERS_WRITE),
  validate({ params: userIdParamsSchema, body: updateUserBodySchema }),
  controller.update,
);

export default router;
