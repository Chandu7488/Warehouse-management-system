/**
 * StockPilot WMS - Sales Orders Express Routes.
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
  createSalesOrderSchema,
  updateSalesOrderSchema,
  listSalesOrdersQuerySchema,
} from './outbound.validator.js';
import {
  createSalesOrderHandler,
  listSalesOrdersHandler,
  getSalesOrderByIdHandler,
  updateSalesOrderHandler,
  confirmSalesOrderHandler,
  allocateSalesOrderHandler,
  cancelSalesOrderHandler,
} from './outbound.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(
    authorize(PERMISSIONS.ORDERS_READ),
    validate({ query: listSalesOrdersQuerySchema }),
    listSalesOrdersHandler,
  )
  .post(
    authorize(PERMISSIONS.ORDERS_WRITE),
    validate({ body: createSalesOrderSchema }),
    createSalesOrderHandler,
  );

router
  .route('/:id')
  .get(authorize(PERMISSIONS.ORDERS_READ), getSalesOrderByIdHandler)
  .patch(
    authorize(PERMISSIONS.ORDERS_WRITE),
    validate({ body: updateSalesOrderSchema }),
    updateSalesOrderHandler,
  );

router.post('/:id/confirm', authorize(PERMISSIONS.ORDERS_WRITE), confirmSalesOrderHandler);
router.post('/:id/allocate', authorize(PERMISSIONS.ORDERS_WRITE), allocateSalesOrderHandler);
router.post('/:id/cancel', authorize(PERMISSIONS.ORDERS_WRITE), cancelSalesOrderHandler);

export default router;
