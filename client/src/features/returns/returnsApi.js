/**
 * StockPilot WMS - Return Orders & Reverse Logistics API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated return orders / RMAs with optional filtering.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Return orders and pagination metadata.
 */
export const fetchReturnOrders = async (params = {}) => {
  const response = await apiClient.get('/returns', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single return order by identifier.
 *
 * @param {string} id - RMA identifier.
 * @returns {Promise<object>} Return order document.
 */
export const fetchReturnOrderById = async (id) => {
  const response = await apiClient.get(`/returns/${id}`);
  return response.data.data;
};

/**
 * Creates a new return merchandise authorization (RMA).
 *
 * @param {object} payload - Creation payload.
 * @returns {Promise<object>} Created return order.
 */
export const createReturnOrder = async (payload) => {
  const response = await apiClient.post('/returns', payload);
  return response.data.data;
};

/**
 * Records dock receiving intake for an RMA.
 *
 * @param {string} id - RMA identifier.
 * @param {object} payload - Receiving intake lines.
 * @returns {Promise<object>} Updated return order.
 */
export const receiveReturnOrder = async (id, payload) => {
  const response = await apiClient.post(`/returns/${id}/receive`, payload);
  return response.data.data;
};

/**
 * Processes quality inspection decisions and commits stock ledger disposition.
 *
 * @param {string} id - RMA identifier.
 * @param {object} payload - Item dispositions.
 * @returns {Promise<object>} Disposed and updated return order.
 */
export const processDisposition = async (id, payload) => {
  const response = await apiClient.post(`/returns/${id}/disposition`, payload);
  return response.data.data;
};

/**
 * Cancels a pending return order.
 *
 * @param {string} id - RMA identifier.
 * @returns {Promise<object>} Cancelled return order.
 */
export const cancelReturnOrder = async (id) => {
  const response = await apiClient.post(`/returns/${id}/cancel`);
  return response.data.data;
};
