/**
 * StockPilot WMS - Authentication middleware.
 *
 * Verifies the access token cookie or bearer authorization header,
 * ensures the user is active, and attaches the user record with permissions to req.user.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { User } from '../modules/users/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken, ACCESS_COOKIE_NAME } from '../modules/auth/token.service.js';
import { getPermissionsForRole } from '../modules/auth/permissions.js';

/**
 * Extracts the access token string from cookies or bearer header.
 *
 * @param {import('express').Request} req - Express request.
 * @returns {string|null} Extracted token or null.
 */
const extractToken = (req) => {
  if (req.cookies?.[ACCESS_COOKIE_NAME]) {
    return req.cookies[ACCESS_COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
};

/**
 * Express middleware that authenticates incoming requests.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} _res - Express response.
 * @param {import('express').NextFunction} next - Next middleware.
 * @returns {Promise<void>}
 */
export const authenticate = async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    return next(ApiError.unauthorized('User no longer exists'));
  }

  if (!user.isActive) {
    return next(ApiError.unauthorized('Account is deactivated'));
  }

  req.user = {
    _id: user._id,
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    warehouses: user.warehouses.map((id) => id.toString()),
    permissions: getPermissionsForRole(user.role),
  };

  return next();
};
