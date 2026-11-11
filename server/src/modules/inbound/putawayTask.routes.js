/**
 * StockPilot WMS - Putaway Task Express Routes.
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
  listPutawayTasksQuerySchema,
  completePutawayTaskSchema,
  suggestLocationQuerySchema,
} from './goodsReceipt.validator.js';
import * as inboundController from './inbound.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(
    authorize([PERMISSIONS.RECEIVING_READ]),
    validate({ query: listPutawayTasksQuerySchema }),
    inboundController.listPutawayTasksHandler,
  );

router.get(
  '/suggest-location',
  authorize([PERMISSIONS.RECEIVING_READ]),
  validate({ query: suggestLocationQuerySchema }),
  inboundController.suggestPutawayLocationHandler,
);

router
  .route('/:id')
  .get(authorize([PERMISSIONS.RECEIVING_READ]), inboundController.getPutawayTaskByIdHandler);

router.post(
  '/:id/complete',
  authorize([PERMISSIONS.RECEIVING_WRITE]),
  validate({ body: completePutawayTaskSchema }),
  inboundController.completePutawayTaskHandler,
);

router.post(
  '/:id/cancel',
  authorize([PERMISSIONS.RECEIVING_WRITE]),
  inboundController.cancelPutawayTaskHandler,
);

export default router;
