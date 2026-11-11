/**
 * StockPilot WMS - Product controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as productService from './product.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Lists products with filtering and pagination.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Paginated products.
 */
export const list = async (req, res) => {
  const { items, meta } = await productService.listProducts(req.validated.query);
  return sendSuccess(res, { message: 'Products retrieved', data: items, meta });
};

/**
 * Retrieves a single product by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Single product.
 */
export const getOne = async (req, res) => {
  const product = await productService.getProductById(req.validated.params.id);
  return sendSuccess(res, { message: 'Product retrieved', data: product });
};

/**
 * Creates a new product.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Created product.
 */
export const create = async (req, res) => {
  const product = await productService.createProduct(req.validated.body);
  return sendSuccess(res, { statusCode: 201, message: 'Product created', data: product });
};

/**
 * Updates an existing product.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Updated product.
 */
export const update = async (req, res) => {
  const product = await productService.updateProduct(req.validated.params.id, req.validated.body);
  return sendSuccess(res, { message: 'Product updated', data: product });
};

/**
 * Deactivates a product.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Deactivated product.
 */
export const deactivate = async (req, res) => {
  const product = await productService.deactivateProduct(req.validated.params.id);
  return sendSuccess(res, { message: 'Product deactivated', data: product });
};

/**
 * Retrieves stock balances for a product.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Product stock list.
 */
export const getStock = async (req, res) => {
  const balances = await productService.getProductStock(req.validated.params.id);
  return sendSuccess(res, { message: 'Product stock retrieved', data: balances });
};

/**
 * Looks up a product by barcode or SKU code.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Matching product.
 */
export const lookup = async (req, res) => {
  const product = await productService.lookupProductByCode(req.validated.query.code);
  return sendSuccess(res, { message: 'Product found', data: product });
};
