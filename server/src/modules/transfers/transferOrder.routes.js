/**
 * StockPilot WMS - Transfers & Replenishment Express Routes.
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
  directBinTransferSchema,
  createTransferOrderSchema,
  dispatchTransferOrderSchema,
  receiveTransferOrderSchema,
  replenishmentRuleInputSchema,
  listTransferOrdersQuerySchema,
} from './transferOrder.validator.js';
import {
  directBinTransferHandler,
  createTransferOrderHandler,
  listTransferOrdersHandler,
  getTransferOrderByIdHandler,
  dispatchTransferOrderHandler,
  receiveTransferOrderHandler,
  cancelTransferOrderHandler,
  upsertReplenishmentRuleHandler,
  listReplenishmentRulesHandler,
  evaluateReplenishmentNeedsHandler,
} from './transferOrder.controller.js';

const router = Router();

router.use(authenticate);

// Direct atomic bin-to-bin relocation
router.post(
  '/direct',
  authorize(PERMISSIONS.TRANSFERS_WRITE, PERMISSIONS.INVENTORY_WRITE),
  validate({ body: directBinTransferSchema }),
  directBinTransferHandler,
);

// Replenishment configuration and automated deficit evaluation
router
  .route('/replenishment/rules')
  .get(
    authorize(PERMISSIONS.TRANSFERS_READ),
    listReplenishmentRulesHandler,
  )
  .post(
    authorize(PERMISSIONS.TRANSFERS_WRITE),
    validate({ body: replenishmentRuleInputSchema }),
    upsertReplenishmentRuleHandler,
  );

router.get(
  '/replenishment/evaluate',
  authorize(PERMISSIONS.TRANSFERS_READ),
  evaluateReplenishmentNeedsHandler,
);

router.get(
  '/replenishment/evaluate/:warehouseId',
  authorize(PERMISSIONS.TRANSFERS_READ),
  evaluateReplenishmentNeedsHandler,
);

// Transfer orders list & creation
router
  .route('/')
  .get(
    authorize(PERMISSIONS.TRANSFERS_READ),
    validate({ query: listTransferOrdersQuerySchema }),
    listTransferOrdersHandler,
  )
  .post(
    authorize(PERMISSIONS.TRANSFERS_WRITE),
    validate({ body: createTransferOrderSchema }),
    createTransferOrderHandler,
  );

// Transfer order lifecycle endpoints
router
  .route('/:id')
  .get(
    authorize(PERMISSIONS.TRANSFERS_READ),
    getTransferOrderByIdHandler,
  );

router.post(
  '/:id/dispatch',
  authorize(PERMISSIONS.TRANSFERS_WRITE, PERMISSIONS.SHIPPING_WRITE),
  validate({ body: dispatchTransferOrderSchema }),
  dispatchTransferOrderHandler,
);

router.post(
  '/:id/receive',
  authorize(PERMISSIONS.TRANSFERS_WRITE, PERMISSIONS.RECEIVING_WRITE),
  validate({ body: receiveTransferOrderSchema }),
  receiveTransferOrderHandler,
);

router.post(
  '/:id/cancel',
  authorize(PERMISSIONS.TRANSFERS_WRITE),
  cancelTransferOrderHandler,
);

export default router;
