/**
 * StockPilot WMS - Customer partner controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as customerService from './customer.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Lists customers with pagination and filtering.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated customers.
 */
export const list = async (req, res) => {
  const { items, meta } = await customerService.listCustomers(req.validated.query);
  return sendSuccess(res, { message: 'Customers retrieved', data: items, meta });
};

/**
 * Retrieves a single customer by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single customer.
 */
export const getOne = async (req, res) => {
  const customer = await customerService.getCustomerById(req.validated.params.id);
  return sendSuccess(res, { message: 'Customer retrieved', data: customer });
};

/**
 * Creates a new customer.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created customer.
 */
export const create = async (req, res) => {
  const customer = await customerService.createCustomer(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Customer created', data: customer });
};

/**
 * Updates an existing customer.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated customer.
 */
export const update = async (req, res) => {
  const customer = await customerService.updateCustomer(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, { message: 'Customer updated', data: customer });
};

/**
 * Deactivates a customer.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated customer.
 */
export const deactivate = async (req, res) => {
  const customer = await customerService.deactivateCustomer(req.validated.params.id);
  return sendSuccess(res, { message: 'Customer deactivated', data: customer });
};
