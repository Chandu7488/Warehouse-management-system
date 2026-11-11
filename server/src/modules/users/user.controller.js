/**
 * StockPilot WMS - User management controller.
 *
 * Translates HTTP requests for user listing, creation, retrieval, and
 * updates into user service invocations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as userService from './user.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Retrieves a paginated list of users.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated users.
 */
export const list = async (req, res) => {
  const { items, meta } = await userService.listUsers(req.validated.query);
  return sendSuccess(res, {
    message: 'Users retrieved',
    data: items,
    meta,
  });
};

/**
 * Retrieves a single user by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} User details.
 */
export const getOne = async (req, res) => {
  const user = await userService.getUserById(req.validated.params.id);
  return sendSuccess(res, {
    message: 'User retrieved',
    data: user,
  });
};

/**
 * Creates a new user record.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created user.
 */
export const create = async (req, res) => {
  const user = await userService.createUser(req.validated.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'User created',
    data: user,
  });
};

/**
 * Updates an existing user record.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated user.
 */
export const update = async (req, res) => {
  const user = await userService.updateUser(
    req.validated.params.id,
    req.validated.body,
    req.user.id,
  );
  return sendSuccess(res, {
    message: 'User updated',
    data: user,
  });
};
