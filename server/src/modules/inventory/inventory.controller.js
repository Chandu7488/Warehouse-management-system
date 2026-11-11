/**
 * StockPilot WMS - Inventory HTTP Controller.
 *
 * Exposes endpoints for stock balances, ledger auditing, stock availability,
 * opening balance creation, and entry reversal.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as inventoryService from './inventory.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Handles stock balance listing with filtering and pagination.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const listBalancesHandler = async (req, res) => {
  const { items, meta } = await inventoryService.listBalances(req.validated.query);
  return sendSuccess(res, {
    message: 'Stock balances retrieved successfully',
    data: items,
    meta,
  });
};

/**
 * Handles stock ledger audit history listing.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const listLedgerEntriesHandler = async (req, res) => {
  const { items, meta } = await inventoryService.listLedgerEntries(req.validated.query);
  return sendSuccess(res, {
    message: 'Stock ledger entries retrieved successfully',
    data: items,
    meta,
  });
};

/**
 * Handles computing product stock availability within a warehouse.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getAvailabilityHandler = async (req, res) => {
  const availability = await inventoryService.getAvailability({
    warehouseId: req.validated.query.warehouse,
    productId: req.validated.query.product,
  });
  return sendSuccess(res, {
    message: 'Stock availability retrieved successfully',
    data: availability,
  });
};

/**
 * Handles retrieving stock details for a product across all warehouses and bins.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getProductStockDetailsHandler = async (req, res) => {
  const stockDetails = await inventoryService.getProductStockDetails(req.params.id);
  return sendSuccess(res, {
    message: 'Product stock details retrieved successfully',
    data: stockDetails,
  });
};

/**
 * Handles posting initial opening stock balances for a warehouse.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const postOpeningBalanceHandler = async (req, res) => {
  const entries = await inventoryService.postOpeningBalance({
    warehouseId: req.validated.body.warehouse,
    items: req.validated.body.items,
    actor: req.user,
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Opening balance posted successfully',
    data: entries,
  });
};

/**
 * Handles reversing a prior stock ledger entry.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const reverseLedgerEntryHandler = async (req, res) => {
  const entry = await inventoryService.reverseLedgerEntry({
    entryId: req.params.id,
    reason: req.validated.body.reason,
    actor: req.user,
  });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Stock ledger entry reversed successfully',
    data: entry,
  });
};
