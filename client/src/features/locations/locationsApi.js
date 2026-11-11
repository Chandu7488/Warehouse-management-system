/**
 * StockPilot WMS - Locations API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated flat list of warehouse locations with optional filters.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Location list and metadata.
 */
export const fetchLocations = async (params = {}) => {
  const response = await apiClient.get('/locations', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches the full hierarchical location tree for a specific warehouse.
 *
 * @param {string} warehouseId - Target warehouse identifier.
 * @returns {Promise<Array<object>>} Nested location roots with child arrays.
 */
export const fetchLocationTree = async (warehouseId) => {
  const response = await apiClient.get('/locations/tree', {
    params: { warehouse: warehouseId },
  });
  return response.data.data;
};

/**
 * Fetches a single location record by its identifier.
 *
 * @param {string} id - Location identifier.
 * @returns {Promise<object>} Location record.
 */
export const fetchLocationById = async (id) => {
  const response = await apiClient.get(`/locations/${id}`);
  return response.data.data;
};

/**
 * Creates a single location within a warehouse.
 *
 * @param {object} payload - Location creation fields.
 * @returns {Promise<object>} Created location.
 */
export const createLocation = async (payload) => {
  const response = await apiClient.post('/locations', payload);
  return response.data.data;
};

/**
 * Bulk generates a rack with shelves and bins in a transaction.
 *
 * @param {object} payload - Bulk parameters.
 * @returns {Promise<object>} Summary of generated locations.
 */
export const bulkCreateLocations = async (payload) => {
  const response = await apiClient.post('/locations/bulk', payload);
  return response.data.data;
};

/**
 * Updates an existing location.
 *
 * @param {string} id - Location identifier.
 * @param {object} payload - Update fields.
 * @returns {Promise<object>} Updated location.
 */
export const updateLocation = async (id, payload) => {
  const response = await apiClient.patch(`/locations/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing location.
 *
 * @param {string} id - Location identifier.
 * @returns {Promise<object>} Deactivated location.
 */
export const deactivateLocation = async (id) => {
  const response = await apiClient.delete(`/locations/${id}`);
  return response.data.data;
};
