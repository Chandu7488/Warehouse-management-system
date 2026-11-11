/**
 * StockPilot WMS - Return Orders / RMA Express Routes.
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
  createReturnOrderSchema,
  receiveReturnOrderSchema,
  processDispositionSchema,
  listReturnOrdersQuerySchema,
} from './returnOrder.validator.js';
import {
  createReturnOrderHandler,
  listReturnOrdersHandler,
  getReturnOrderByIdHandler,
  receiveReturnOrderHandler,
  processDispositionHandler,
  cancelReturnOrderHandler,
} from './returnOrder.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(
    authorize(PERMISSIONS.RETURNS_READ, PERMISSIONS.ORDERS_READ),
    validate({ query: listReturnOrdersQuerySchema }),
    listReturnOrdersHandler,
  )
  .post(
    authorize(PERMISSIONS.RETURNS_WRITE, PERMISSIONS.ORDERS_WRITE),
    validate({ body: createReturnOrderSchema }),
    createReturnOrderHandler,
  );

router
  .route('/:id')
  .get(
    authorize(PERMISSIONS.RETURNS_READ, PERMISSIONS.ORDERS_READ),
    getReturnOrderByIdHandler,
  );

router.post(
  '/:id/receive',
  authorize(PERMISSIONS.RETURNS_WRITE, PERMISSIONS.RECEIVING_WRITE),
  validate({ body: receiveReturnOrderSchema }),
  receiveReturnOrderHandler,
);

router.post(
  '/:id/disposition',
  authorize(PERMISSIONS.RETURNS_WRITE, PERMISSIONS.RECEIVING_INSPECT),
  validate({ body: processDispositionSchema }),
  processDispositionHandler,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.RETURNS_WRITE, PERMISSIONS.ORDERS_WRITE),
  cancelReturnOrderHandler,
);

export default router;
