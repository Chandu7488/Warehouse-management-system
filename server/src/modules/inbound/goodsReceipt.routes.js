/**
 * StockPilot WMS - Goods Receipt Express Routes.
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
  createGoodsReceiptSchema,
  listGoodsReceiptsQuerySchema,
} from './goodsReceipt.validator.js';
import * as inboundController from './inbound.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .post(
    authorize([PERMISSIONS.RECEIVING_WRITE]),
    validate({ body: createGoodsReceiptSchema }),
    inboundController.createGoodsReceiptHandler,
  )
  .get(
    authorize([PERMISSIONS.RECEIVING_READ]),
    validate({ query: listGoodsReceiptsQuerySchema }),
    inboundController.listGoodsReceiptsHandler,
  );

router
  .route('/:id')
  .get(authorize([PERMISSIONS.RECEIVING_READ]), inboundController.getGoodsReceiptByIdHandler);

export default router;
