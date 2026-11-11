/**
 * StockPilot WMS - Sales Orders API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated sales orders with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, customer, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Orders and pagination metadata.
 */
export const fetchSalesOrders = async (params = {}) => {
  const response = await apiClient.get('/sales-orders', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single sales order by identifier.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Sales order document.
 */
export const fetchSalesOrderById = async (id) => {
  const response = await apiClient.get(`/sales-orders/${id}`);
  return response.data.data;
};

/**
 * Creates a new draft sales order.
 *
 * @param {object} payload - Creation payload.
 * @returns {Promise<object>} Created sales order.
 */
export const createSalesOrder = async (payload) => {
  const response = await apiClient.post('/sales-orders', payload);
  return response.data.data;
};

/**
 * Updates a draft sales order.
 *
 * @param {string} id - Sales order identifier.
 * @param {object} payload - Fields to update.
 * @returns {Promise<object>} Updated sales order.
 */
export const updateSalesOrder = async (id, payload) => {
  const response = await apiClient.patch(`/sales-orders/${id}`, payload);
  return response.data.data;
};

/**
 * Confirms a draft sales order and attempts inventory reservation.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Confirmed sales order.
 */
export const confirmSalesOrder = async (id) => {
  const response = await apiClient.post(`/sales-orders/${id}/confirm`);
  return response.data.data;
};

/**
 * Manually executes hard stock allocation on a confirmed order.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Allocated sales order.
 */
export const allocateSalesOrder = async (id) => {
  const response = await apiClient.post(`/sales-orders/${id}/allocate`);
  return response.data.data;
};

/**
 * Cancels a sales order and releases all reserved inventory.
 *
 * @param {string} id - Sales order identifier.
 * @returns {Promise<object>} Cancelled sales order.
 */
export const cancelSalesOrder = async (id) => {
  const response = await apiClient.post(`/sales-orders/${id}/cancel`);
  return response.data.data;
};
