/**
 * StockPilot WMS - Wave / Pick Lists Express Routes.
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
  createPickListSchema,
  listPickListsQuerySchema,
  confirmPickItemSchema,
} from './outbound.validator.js';
import {
  createPickListHandler,
  listPickListsHandler,
  getPickListByIdHandler,
  startPickListHandler,
  confirmPickItemHandler,
  cancelPickListHandler,
} from './outbound.controller.js';

const router = Router();

router.use(authenticate);

router
  .route('/')
  .get(
    authorize(PERMISSIONS.PICKING_READ),
    validate({ query: listPickListsQuerySchema }),
    listPickListsHandler,
  )
  .post(
    authorize(PERMISSIONS.PICKING_WRITE),
    validate({ body: createPickListSchema }),
    createPickListHandler,
  );

router.route('/:id').get(authorize(PERMISSIONS.PICKING_READ), getPickListByIdHandler);

router.post('/:id/start', authorize(PERMISSIONS.PICKING_EXECUTE, PERMISSIONS.PICKING_WRITE), startPickListHandler);

router.post(
  '/:id/items/:itemId/confirm',
  authorize(PERMISSIONS.PICKING_EXECUTE, PERMISSIONS.PICKING_WRITE),
  validate({ body: confirmPickItemSchema }),
  confirmPickItemHandler,
);

router.post('/:id/cancel', authorize(PERMISSIONS.PICKING_WRITE), cancelPickListHandler);

export default router;
