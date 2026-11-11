/**
 * StockPilot WMS - Outbound Shipments Express Routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  createShipmentSchema,
  listShipmentsQuerySchema,
  dispatchShipmentSchema,
} from './outbound.validator.js';
import {
  createShipmentHandler,
  listShipmentsHandler,
  getShipmentByIdHandler,
  dispatchShipmentHandler,
} from './outbound.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(
    authorize(PERMISSIONS.SHIPPING_READ),
    validate({ query: listShipmentsQuerySchema }),
    listShipmentsHandler,
  )
  .post(
    authorize(PERMISSIONS.SHIPPING_WRITE),
    validate({ body: createShipmentSchema }),
    createShipmentHandler,
  );

router.route('/:id').get(authorize(PERMISSIONS.SHIPPING_READ), getShipmentByIdHandler);

router.post(
  '/:id/dispatch',
  authorize(PERMISSIONS.SHIPPING_WRITE),
  validate({ body: dispatchShipmentSchema }),
  dispatchShipmentHandler,
);

export default router;
