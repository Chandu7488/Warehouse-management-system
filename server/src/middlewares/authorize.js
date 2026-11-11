/**
 * StockPilot WMS - Authorization middleware.
 *
 * Verifies that the authenticated user possesses the permission string required
 * to access an endpoint according to the RBAC matrix.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { ApiError } from '../utils/ApiError.js';

/**
 * Creates an authorization middleware for one or more permission strings.
 *
 * @param {...string} requiredPermissions - One or more permissions required.
 * @returns {import('express').RequestHandler} Authorization middleware.
 */
export const authorize =
  (...requiredPermissions) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    const flat = requiredPermissions.flat();
    const userPermissions = new Set(req.user.permissions ?? []);
    const hasAll = flat.every((perm) => userPermissions.has(perm));

    if (!hasAll) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }

    return next();
  };
