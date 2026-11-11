/**
 * StockPilot WMS - Unit of measure controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as unitService from './unit.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Lists units with pagination and search.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated units.
 */
export const list = async (req, res) => {
  const { items, meta } = await unitService.listUnits(req.validated.query);
  return sendSuccess(res, { message: 'Units retrieved', data: items, meta });
};

/**
 * Retrieves a single unit by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single unit.
 */
export const getOne = async (req, res) => {
  const unit = await unitService.getUnitById(req.validated.params.id);
  return sendSuccess(res, { message: 'Unit retrieved', data: unit });
};

/**
 * Creates a unit of measure.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created unit.
 */
export const create = async (req, res) => {
  const unit = await unitService.createUnit(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Unit created', data: unit });
};

/**
 * Updates a unit of measure.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated unit.
 */
export const update = async (req, res) => {
  const unit = await unitService.updateUnit(req.validated.params.id, req.validated.body);
  return sendSuccess(res, { message: 'Unit updated', data: unit });
};

/**
 * Deactivates a unit of measure.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated unit.
 */
export const deactivate = async (req, res) => {
  const unit = await unitService.deactivateUnit(req.validated.params.id);
  return sendSuccess(res, { message: 'Unit deactivated', data: unit });
};
