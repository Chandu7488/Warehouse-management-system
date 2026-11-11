/**
 * StockPilot WMS - Request validation middleware.
 *
 * Validates body, query and params with Zod schemas. Express 5 exposes
 * req.query as a read-only getter, so parsed values are stored on
 * req.validated instead of overwriting the original request properties.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { ApiError } from '../utils/ApiError.js';

const SOURCES = ['params', 'query', 'body'];

/**
 * Creates a middleware that validates parts of the request.
 *
 * @param {object} schemas - Zod schemas keyed by params, query and body.
 * @returns {import('express').RequestHandler} Validation middleware.
 */
export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  const details = [];
  for (const source of SOURCES) {
    const schema = schemas[source];
    if (!schema) {
      continue;
    }
    const result = schema.safeParse(req[source]);
    if (result.success) {
      validated[source] = result.data;
    } else {
      for (const issue of result.error.issues) {
        details.push({ source, field: issue.path.join('.'), message: issue.message });
      }
    }
  }
  if (details.length > 0) {
    return next(ApiError.unprocessable('Validation failed', details));
  }
  req.validated = validated;
  return next();
};
