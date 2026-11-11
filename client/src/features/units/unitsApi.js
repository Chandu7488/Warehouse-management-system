/**
 * StockPilot WMS - Units API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated units with optional query filters.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Unit list and pagination metadata.
 */
export const fetchUnits = async (params = {}) => {
  const response = await apiClient.get('/units', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Creates a new unit of measurement.
 *
 * @param {object} payload - Unit payload.
 * @returns {Promise<object>} Created unit.
 */
export const createUnit = async (payload) => {
  const response = await apiClient.post('/units', payload);
  return response.data.data;
};

/**
 * Updates an existing unit.
 *
 * @param {string} id - Unit identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated unit.
 */
export const updateUnit = async (id, payload) => {
  const response = await apiClient.patch(`/units/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing unit.
 *
 * @param {string} id - Unit identifier.
 * @returns {Promise<object>} Deactivated unit.
 */
export const deactivateUnit = async (id) => {
  const response = await apiClient.delete(`/units/${id}`);
  return response.data.data;
};
