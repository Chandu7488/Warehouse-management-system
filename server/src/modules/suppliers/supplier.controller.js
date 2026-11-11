/**
 * StockPilot WMS - Supplier partner controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as supplierService from './supplier.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Lists suppliers with pagination and filtering.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated suppliers.
 */
export const list = async (req, res) => {
  const { items, meta } = await supplierService.listSuppliers(req.validated.query);
  return sendSuccess(res, { message: 'Suppliers retrieved', data: items, meta });
};

/**
 * Retrieves a single supplier by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single supplier.
 */
export const getOne = async (req, res) => {
  const supplier = await supplierService.getSupplierById(req.validated.params.id);
  return sendSuccess(res, { message: 'Supplier retrieved', data: supplier });
};

/**
 * Creates a new supplier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created supplier.
 */
export const create = async (req, res) => {
  const supplier = await supplierService.createSupplier(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Supplier created', data: supplier });
};

/**
 * Updates an existing supplier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated supplier.
 */
export const update = async (req, res) => {
  const supplier = await supplierService.updateSupplier(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, { message: 'Supplier updated', data: supplier });
};

/**
 * Deactivates a supplier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated supplier.
 */
export const deactivate = async (req, res) => {
  const supplier = await supplierService.deactivateSupplier(req.validated.params.id);
  return sendSuccess(res, { message: 'Supplier deactivated', data: supplier });
};
