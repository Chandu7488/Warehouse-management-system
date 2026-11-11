/**
 * StockPilot WMS - Standard API response helpers.
 *
 * Every successful response uses the envelope { success, message, data, meta }.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
/**
 * Sends a successful JSON response.
 *
 * @param {import('express').Response} res - Express response.
 * @param {object} options - Response options.
 * @param {number} [options.statusCode=200] - HTTP status code.
 * @param {string} [options.message='OK'] - Human readable message.
 * @param {unknown} [options.data=null] - Response payload.
 * @param {object} [options.meta] - Optional metadata such as pagination.
 * @returns {import('express').Response} The Express response.
 */
export const sendSuccess = (res, { statusCode = 200, message = 'OK', data = null, meta } = {}) => {
  const body = { success: true, message, data };
  if (meta) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
};
