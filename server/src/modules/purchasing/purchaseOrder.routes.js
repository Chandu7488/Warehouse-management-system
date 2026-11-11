/**
 * StockPilot WMS - Purchase Order Express Routes.
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
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
} from './purchaseOrder.validator.js';
import * as poController from './purchaseOrder.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .post(
    authorize([PERMISSIONS.PURCHASING_WRITE]),
    validate({ body: createPurchaseOrderSchema }),
    poController.createPurchaseOrderHandler,
  )
  .get(
    authorize([PERMISSIONS.PURCHASING_READ]),
    validate({ query: listPurchaseOrdersQuerySchema }),
    poController.listPurchaseOrdersHandler,
  );

router
  .route('/:id')
  .get(authorize([PERMISSIONS.PURCHASING_READ]), poController.getPurchaseOrderByIdHandler)
  .put(
    authorize([PERMISSIONS.PURCHASING_WRITE]),
    validate({ body: updatePurchaseOrderSchema }),
    poController.updatePurchaseOrderHandler,
  );

router.post(
  '/:id/confirm',
  authorize([PERMISSIONS.PURCHASING_WRITE]),
  poController.confirmPurchaseOrderHandler,
);

router.post(
  '/:id/cancel',
  authorize([PERMISSIONS.PURCHASING_WRITE]),
  poController.cancelPurchaseOrderHandler,
);

export default router;
