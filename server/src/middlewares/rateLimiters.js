/**
 * StockPilot WMS - Endpoint rate limiters.
 *
 * Configures protective rate limiting for authentication and sensitive operations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts, please try again later',
    },
  },
});
