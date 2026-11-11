/**
 * StockPilot WMS - Location routes.
 *
 * Configures endpoints, validation schemas, and RBAC authorization rules
 * for warehouse location tree operations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import {
  listLocationsHandler,
  getLocationTreeHandler,
  getLocationByIdHandler,
  createLocationHandler,
  bulkCreateLocationsHandler,
  updateLocationHandler,
  deactivateLocationHandler,
} from './location.controller.js';
import {
  locationIdParamsSchema,
  createLocationBodySchema,
  updateLocationBodySchema,
  bulkCreateLocationsBodySchema,
  listLocationsQuerySchema,
  treeLocationsQuerySchema,
} from './location.validator.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { PERMISSIONS } from '../auth/permissions.js';

export const locationRouter = Router();

locationRouter.get(
  '/',
  validate({ query: listLocationsQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_READ),
  listLocationsHandler,
);

locationRouter.get(
  '/tree',
  validate({ query: treeLocationsQuerySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_READ),
  getLocationTreeHandler,
);

locationRouter.post(
  '/bulk',
  validate({ body: bulkCreateLocationsBodySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  bulkCreateLocationsHandler,
);

locationRouter.post(
  '/',
  validate({ body: createLocationBodySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  createLocationHandler,
);

locationRouter.get(
  '/:id',
  validate({ params: locationIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_READ),
  getLocationByIdHandler,
);

locationRouter.patch(
  '/:id',
  validate({ params: locationIdParamsSchema, body: updateLocationBodySchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  updateLocationHandler,
);

locationRouter.delete(
  '/:id',
  validate({ params: locationIdParamsSchema }),
  authenticate,
  authorize(PERMISSIONS.WAREHOUSES_WRITE),
  deactivateLocationHandler,
);
