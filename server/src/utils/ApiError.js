/**
 * StockPilot WMS - Operational API error.
 *
 * Represents an expected failure that must be reported to the client with a
 * specific HTTP status code and a stable machine readable error code.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code.
   * @param {string} code - Stable machine readable error code.
   * @param {string} message - Human readable message.
   * @param {unknown} [details] - Optional structured details such as field errors.
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @param {unknown} [details] - Field level details.
   * @returns {ApiError} HTTP 400 error.
   */
  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @returns {ApiError} HTTP 401 error.
   */
  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @returns {ApiError} HTTP 403 error.
   */
  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @returns {ApiError} HTTP 404 error.
   */
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @returns {ApiError} HTTP 409 error.
   */
  static conflict(message = 'Resource already exists') {
    return new ApiError(409, 'CONFLICT', message);
  }

  /**
   * @param {string} [message] - Human readable message.
   * @param {unknown} [details] - Field level details.
   * @returns {ApiError} HTTP 422 error.
   */
  static unprocessable(message = 'Validation failed', details) {
    return new ApiError(422, 'VALIDATION_ERROR', message, details);
  }
}
