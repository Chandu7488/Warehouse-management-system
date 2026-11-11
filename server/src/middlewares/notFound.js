/**
 * StockPilot WMS - Unknown route handler.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { ApiError } from '../utils/ApiError.js';

/**
 * Forwards a 404 error for any request that matched no route.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} _res - Express response.
 * @param {import('express').NextFunction} next - Next middleware.
 * @returns {void}
 */
export const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
