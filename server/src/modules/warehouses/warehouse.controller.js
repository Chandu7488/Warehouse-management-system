/**
 * StockPilot WMS - Warehouse controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as warehouseService from './warehouse.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Lists warehouses with pagination and filtering.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated warehouses.
 */
export const list = async (req, res) => {
  const { items, meta } = await warehouseService.listWarehouses(req.validated.query);
  return sendSuccess(res, { message: 'Warehouses retrieved', data: items, meta });
};

/**
 * Retrieves a single warehouse by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single warehouse.
 */
export const getOne = async (req, res) => {
  const warehouse = await warehouseService.getWarehouseById(req.validated.params.id);
  return sendSuccess(res, { message: 'Warehouse retrieved', data: warehouse });
};

/**
 * Creates a new warehouse site.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created warehouse.
 */
export const create = async (req, res) => {
  const warehouse = await warehouseService.createWarehouse(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Warehouse created', data: warehouse });
};

/**
 * Updates an existing warehouse site.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated warehouse.
 */
export const update = async (req, res) => {
  const warehouse = await warehouseService.updateWarehouse(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, { message: 'Warehouse updated', data: warehouse });
};

/**
 * Deactivates a warehouse site.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated warehouse.
 */
export const deactivate = async (req, res) => {
  const warehouse = await warehouseService.deactivateWarehouse(req.validated.params.id);
  return sendSuccess(res, { message: 'Warehouse deactivated', data: warehouse });
};
