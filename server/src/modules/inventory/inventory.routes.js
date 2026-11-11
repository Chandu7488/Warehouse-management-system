/**
 * StockPilot WMS - Inventory Routes.
 *
 * Exposes endpoints for balances, audit ledger, availability checks,
 * administrative opening balances, and ledger entry reversals.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './inventory.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { authorize } from '../../middlewares/authorize.js';
import { validate } from '../../middlewares/validate.js';
import { PERMISSIONS } from '../auth/permissions.js';
import {
  listBalancesQuerySchema,
  listLedgerQuerySchema,
  availabilityQuerySchema,
  openingBalanceSchema,
  reverseLedgerSchema,
} from './inventory.validator.js';

const router = Router();

router.get(
  '/balances',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  validate({ query: listBalancesQuerySchema }),
  controller.listBalancesHandler,
);

router.get(
  '/ledger',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  validate({ query: listLedgerQuerySchema }),
  controller.listLedgerEntriesHandler,
);

router.get(
  '/availability',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_READ),
  validate({ query: availabilityQuerySchema }),
  controller.getAvailabilityHandler,
);

router.post(
  '/opening-balance',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_OPENING),
  validate({ body: openingBalanceSchema }),
  controller.postOpeningBalanceHandler,
);

router.post(
  '/ledger/:id/reverse',
  authenticate,
  authorize(PERMISSIONS.INVENTORY_REVERSE),
  validate({ body: reverseLedgerSchema }),
  controller.reverseLedgerEntryHandler,
);

export default router;
