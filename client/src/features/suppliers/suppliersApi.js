/**
 * StockPilot WMS - Suppliers API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated suppliers with optional search.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Supplier list and metadata.
 */
export const fetchSuppliers = async (params = {}) => {
  const response = await apiClient.get('/suppliers', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single supplier by identifier.
 *
 * @param {string} id - Supplier identifier.
 * @returns {Promise<object>} Supplier record.
 */
export const fetchSupplierById = async (id) => {
  const response = await apiClient.get(`/suppliers/${id}`);
  return response.data.data;
};

/**
 * Creates a new supplier.
 *
 * @param {object} payload - Supplier payload.
 * @returns {Promise<object>} Created supplier.
 */
export const createSupplier = async (payload) => {
  const response = await apiClient.post('/suppliers', payload);
  return response.data.data;
};

/**
 * Updates an existing supplier.
 *
 * @param {string} id - Supplier identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated supplier.
 */
export const updateSupplier = async (id, payload) => {
  const response = await apiClient.patch(`/suppliers/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing supplier.
 *
 * @param {string} id - Supplier identifier.
 * @returns {Promise<object>} Deactivated supplier.
 */
export const deactivateSupplier = async (id) => {
  const response = await apiClient.delete(`/suppliers/${id}`);
  return response.data.data;
};
