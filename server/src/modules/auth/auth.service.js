/**
 * StockPilot WMS - Authentication business logic.
 *
 * Implements user authentication, brute-force lockout, refresh token rotation,
 * reuse detection, and session revocation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import bcrypt from 'bcryptjs';
import { User } from '../users/user.model.js';
import { RefreshToken } from './refreshToken.model.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  SEVEN_DAYS_MS,
} from './token.service.js';
import { getPermissionsForRole } from './permissions.js';

const BCRYPT_SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

/**
 * Authenticates user credentials and creates session tokens.
 *
 * @param {object} params - Authentication params.
 * @param {string} params.email - User email.
 * @param {string} params.password - Plain password.
 * @param {string} [params.userAgent] - Client user agent string.
 * @param {string} [params.ip] - Client IP address.
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>} Auth session.
 * @throws {ApiError} When authentication fails or account is locked.
 */
export const login = async ({ email, password, userAgent = '', ip = '' }) => {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.unauthorized('Account is deactivated');
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw ApiError.forbidden(
      'Account is temporarily locked due to repeated failed login attempts. Please try again later.',
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    const nextFailedCount = (user.failedLoginCount || 0) + 1;
    user.failedLoginCount = nextFailedCount;
    if (nextFailedCount >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }
    await user.save();
    throw ApiError.unauthorized('Invalid email or password');
  }

  user.failedLoginCount = 0;
  user.lockedUntil = null;
  user.lastLoginAt = now;
  await user.save();

  const userObj = user.toJSON();
  const accessToken = generateAccessToken(userObj);
  const rawRefreshToken = generateRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    userAgent,
    ip,
  });

  return {
    user: {
      ...userObj,
      permissions: getPermissionsForRole(user.role),
    },
    accessToken,
    refreshToken: rawRefreshToken,
  };
};

/**
 * Rotates an existing refresh token and issues a fresh token pair.
 * Detects token reuse and invalidates the entire token chain if found.
 *
 * @param {object} params - Refresh parameters.
 * @param {string} params.rawRefreshToken - Raw refresh token from cookie.
 * @param {string} [params.userAgent] - Client user agent string.
 * @param {string} [params.ip] - Client IP address.
 * @returns {Promise<{user: object, accessToken: string, refreshToken: string}>} Fresh tokens.
 * @throws {ApiError} When the refresh token is missing, expired, or reused.
 */
export const refresh = async ({ rawRefreshToken, userAgent = '', ip = '' }) => {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (tokenDoc.revokedAt) {
    await RefreshToken.updateMany({ user: tokenDoc.user }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Refresh token reuse detected; all sessions revoked');
  }

  if (tokenDoc.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token has expired');
  }

  const user = await User.findById(tokenDoc.user);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User is no longer active');
  }

  const userObj = user.toJSON();
  const newAccessToken = generateAccessToken(userObj);
  const newRawRefreshToken = generateRefreshToken();

  const newDoc = await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(newRawRefreshToken),
    expiresAt: new Date(Date.now() + SEVEN_DAYS_MS),
    userAgent,
    ip,
  });

  tokenDoc.revokedAt = new Date();
  tokenDoc.replacedBy = newDoc._id;
  await tokenDoc.save();

  return {
    user: {
      ...userObj,
      permissions: getPermissionsForRole(user.role),
    },
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
};

/**
 * Revokes the provided refresh token session.
 *
 * @param {string} rawRefreshToken - Raw refresh token string.
 * @returns {Promise<void>}
 */
export const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) {
    return;
  }
  const tokenHash = hashToken(rawRefreshToken);
  await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
};

/**
 * Updates the user's password and revokes existing refresh tokens.
 *
 * @param {string} userId - User identifier.
 * @param {object} payload - Password update payload.
 * @param {string} payload.currentPassword - Existing password.
 * @param {string} payload.newPassword - New password to hash.
 * @returns {Promise<void>}
 * @throws {ApiError} When current password is wrong or user is missing.
 */
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await user.save();

  await RefreshToken.updateMany({ user: user._id }, { revokedAt: new Date() });
};

/**
 * Retrieves the current authenticated user record with permissions.
 *
 * @param {string} userId - User identifier.
 * @returns {Promise<object>} User profile with permissions.
 * @throws {ApiError} When user does not exist.
 */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return {
    ...user.toJSON(),
    permissions: getPermissionsForRole(user.role),
  };
};
