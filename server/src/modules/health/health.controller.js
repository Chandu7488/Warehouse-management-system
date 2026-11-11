/**
 * StockPilot WMS - Health check controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { getDatabaseState } from '../../config/database.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Reports process uptime and database connectivity.
 *
 * @param {import('express').Request} _req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {import('express').Response} Health payload.
 */
export const getHealth = (_req, res) =>
  sendSuccess(res, {
    message: 'StockPilot API is running',
    data: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: getDatabaseState(),
    },
  });
