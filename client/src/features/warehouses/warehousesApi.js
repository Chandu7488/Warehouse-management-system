/**
 * StockPilot WMS - Warehouses API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated warehouses with optional search.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Warehouse list and metadata.
 */
export const fetchWarehouses = async (params = {}) => {
  const response = await apiClient.get('/warehouses', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single warehouse by identifier.
 *
 * @param {string} id - Warehouse identifier.
 * @returns {Promise<object>} Warehouse record.
 */
export const fetchWarehouseById = async (id) => {
  const response = await apiClient.get(`/warehouses/${id}`);
  return response.data.data;
};

/**
 * Creates a new warehouse.
 *
 * @param {object} payload - Warehouse payload.
 * @returns {Promise<object>} Created warehouse.
 */
export const createWarehouse = async (payload) => {
  const response = await apiClient.post('/warehouses', payload);
  return response.data.data;
};

/**
 * Updates an existing warehouse.
 *
 * @param {string} id - Warehouse identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated warehouse.
 */
export const updateWarehouse = async (id, payload) => {
  const response = await apiClient.patch(`/warehouses/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing warehouse.
 *
 * @param {string} id - Warehouse identifier.
 * @returns {Promise<object>} Deactivated warehouse.
 */
export const deactivateWarehouse = async (id) => {
  const response = await apiClient.delete(`/warehouses/${id}`);
  return response.data.data;
};
