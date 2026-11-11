/**
 * StockPilot WMS - Authentication API services.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Authenticates user credentials.
 *
 * @param {object} payload - Login fields.
 * @param {string} payload.email - User email.
 * @param {string} payload.password - Plain password.
 * @returns {Promise<object>} Authenticated user profile.
 */
export const loginUser = async (payload) => {
  const response = await apiClient.post('/auth/login', payload);
  return response.data.data;
};

/**
 * Revokes current session and clears server-side tokens.
 *
 * @returns {Promise<void>}
 */
export const logoutUser = async () => {
  await apiClient.post('/auth/logout');
};

/**
 * Retrieves the currently logged-in user profile.
 *
 * @returns {Promise<object>} User profile with permissions.
 */
export const fetchMe = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data.data;
};

/**
 * Updates user password.
 *
 * @param {object} payload - Password update fields.
 * @param {string} payload.currentPassword - Existing password.
 * @param {string} payload.newPassword - New password.
 * @returns {Promise<void>}
 */
export const changePassword = async (payload) => {
  await apiClient.patch('/auth/me/password', payload);
};
