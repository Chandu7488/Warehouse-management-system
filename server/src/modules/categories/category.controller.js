/**
 * StockPilot WMS - Category controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as categoryService from './category.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated category list.
 */
export const list = async (req, res) => {
  const { items, meta } = await categoryService.listCategories(req.validated.query);
  return sendSuccess(res, { message: 'Categories retrieved', data: items, meta });
};

/**
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single category.
 */
export const getOne = async (req, res) => {
  const category = await categoryService.getCategoryById(req.validated.params.id);
  return sendSuccess(res, { message: 'Category retrieved', data: category });
};

/**
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created category.
 */
export const create = async (req, res) => {
  const category = await categoryService.createCategory(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Category created', data: category });
};

/**
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated category.
 */
export const update = async (req, res) => {
  const category = await categoryService.updateCategory(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, { message: 'Category updated', data: category });
};

/**
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated category.
 */
export const deactivate = async (req, res) => {
  const category = await categoryService.deactivateCategory(req.validated.params.id);
  return sendSuccess(res, { message: 'Category deactivated', data: category });
};
