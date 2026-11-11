/**
 * StockPilot WMS - Authentication token service.
 *
 * Handles creation, hashing, verification, and cookie serialization
 * of JSON Web Tokens and refresh tokens.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Computes a SHA-256 hexadecimal digest of a token string.
 *
 * @param {string} token - Raw token string.
 * @returns {string} SHA-256 digest.
 */
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Generates a signed access token.
 *
 * @param {{id: string, role: string}} user - User identity payload.
 * @returns {string} Signed JWT.
 */
export const generateAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

/**
 * Generates an opaque cryptographically secure refresh token string.
 *
 * @returns {string} 96-character hex token string.
 */
export const generateRefreshToken = () => crypto.randomBytes(48).toString('hex');

/**
 * Verifies an access token and returns its decoded payload.
 *
 * @param {string} token - JWT access token string.
 * @returns {object} Decoded JWT payload.
 */
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

/**
 * Attaches HTTP-only auth cookies to the response.
 *
 * @param {import('express').Response} res - Express response.
 * @param {{accessToken: string, refreshToken: string}} tokens - Token pair.
 * @returns {void}
 */
export const setAuthCookies = (res, { accessToken, refreshToken }) => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
  };

  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...cookieOptions,
    maxAge: FIFTEEN_MINUTES_MS,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieOptions,
    maxAge: SEVEN_DAYS_MS,
  });
};

/**
 * Clears authentication cookies on the response.
 *
 * @param {import('express').Response} res - Express response.
 * @returns {void}
 */
export const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    path: '/',
  };

  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions);
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
};

export { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, SEVEN_DAYS_MS };
