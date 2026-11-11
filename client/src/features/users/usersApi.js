/**
 * StockPilot WMS - User management API services.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Retrieves a paginated list of system users.
 *
 * @param {object} [params] - Query parameters.
 * @param {number} [params.page] - Page number.
 * @param {number} [params.limit] - Page limit.
 * @param {string} [params.search] - Search keyword.
 * @param {string} [params.role] - Role filter.
 * @param {boolean} [params.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} List of users and pagination metadata.
 */
export const fetchUsers = async (params = {}) => {
  const response = await apiClient.get('/users', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Creates a new system user.
 *
 * @param {object} payload - User creation fields.
 * @returns {Promise<object>} Created user.
 */
export const createUser = async (payload) => {
  const response = await apiClient.post('/users', payload);
  return response.data.data;
};

/**
 * Updates an existing user record.
 *
 * @param {string} id - User identifier.
 * @param {object} payload - Fields to update.
 * @returns {Promise<object>} Updated user.
 */
export const updateUser = async (id, payload) => {
  const response = await apiClient.patch(`/users/${id}`, payload);
  return response.data.data;
};
