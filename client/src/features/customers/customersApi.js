/**
 * StockPilot WMS - Customers API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated customers with optional search.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Customer list and metadata.
 */
export const fetchCustomers = async (params = {}) => {
  const response = await apiClient.get('/customers', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single customer by identifier.
 *
 * @param {string} id - Customer identifier.
 * @returns {Promise<object>} Customer record.
 */
export const fetchCustomerById = async (id) => {
  const response = await apiClient.get(`/customers/${id}`);
  return response.data.data;
};

/**
 * Creates a new customer.
 *
 * @param {object} payload - Customer payload.
 * @returns {Promise<object>} Created customer.
 */
export const createCustomer = async (payload) => {
  const response = await apiClient.post('/customers', payload);
  return response.data.data;
};

/**
 * Updates an existing customer.
 *
 * @param {string} id - Customer identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated customer.
 */
export const updateCustomer = async (id, payload) => {
  const response = await apiClient.patch(`/customers/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing customer.
 *
 * @param {string} id - Customer identifier.
 * @returns {Promise<object>} Deactivated customer.
 */
export const deactivateCustomer = async (id) => {
  const response = await apiClient.delete(`/customers/${id}`);
  return response.data.data;
};
