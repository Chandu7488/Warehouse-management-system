/**
 * StockPilot WMS - Central error handler.
 *
 * Converts every thrown error into the standard error envelope
 * { success: false, error: { code, message, details } }.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../config/env.js';

const DUPLICATE_KEY_CODE = 11000;

/**
 * Normalises any thrown value into an ApiError.
 *
 * @param {unknown} error - Thrown value.
 * @returns {ApiError} Normalised operational error or an internal error.
 */
const normaliseError = (error) => {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
    return ApiError.unprocessable('Validation failed', details);
  }
  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${error.path}`);
  }
  if (error?.code === DUPLICATE_KEY_CODE) {
    const fields = Object.keys(error.keyValue ?? {}).join(', ');
    return ApiError.conflict(`Duplicate value for: ${fields}`);
  }
  if (error?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body');
  }
  return new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong');
};

/**
 * Express error handling middleware.
 *
 * @param {unknown} error - Thrown value.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @param {import('express').NextFunction} _next - Next middleware.
 * @returns {import('express').Response} JSON error response.
 */
export const errorHandler = (error, req, res, _next) => {
  const apiError = normaliseError(error);
  if (apiError.statusCode >= 500) {
    logger.error('Unhandled error', {
      method: req.method,
      url: req.originalUrl,
      message: error?.message,
      stack: isProduction ? undefined : error?.stack,
    });
  }
  const body = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  };
  if (apiError.details !== undefined) {
    body.error.details = apiError.details;
  }
  return res.status(apiError.statusCode).json(body);
};
