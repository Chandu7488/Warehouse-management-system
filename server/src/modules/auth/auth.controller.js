/**
 * StockPilot WMS - Authentication controller.
 *
 * Translates HTTP requests for login, token refresh, logout, password change,
 * and profile retrieval into auth service calls and manages auth cookies.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as authService from './auth.service.js';
import { setAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from './token.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Handles user login and sets authentication cookies.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Success envelope with user details.
 */
export const login = async (req, res) => {
  const result = await authService.login({
    ...req.validated.body,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return sendSuccess(res, {
    message: 'Logged in successfully',
    data: result.user,
  });
};

/**
 * Rotates the refresh token and sets renewed cookies.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Success envelope with refreshed user.
 */
export const refresh = async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const result = await authService.refresh({
    rawRefreshToken,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  setAuthCookies(res, {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  });

  return sendSuccess(res, {
    message: 'Session refreshed',
    data: result.user,
  });
};

/**
 * Revokes current session and clears authentication cookies.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Logout confirmation.
 */
export const logout = async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  await authService.logout(rawRefreshToken);
  clearAuthCookies(res);

  return sendSuccess(res, {
    message: 'Logged out successfully',
  });
};

/**
 * Retrieves the profile and permissions for the authenticated user.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Profile details.
 */
export const getMe = async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return sendSuccess(res, {
    message: 'Current user retrieved',
    data: user,
  });
};

/**
 * Updates the authenticated user's password and clears active session cookies.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>} Confirmation message.
 */
export const changePassword = async (req, res) => {
  await authService.changePassword(req.user.id, req.validated.body);
  clearAuthCookies(res);

  return sendSuccess(res, {
    message: 'Password changed successfully. Please log in again.',
  });
};
