/**
 * StockPilot WMS - Purchasing API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated list of purchase orders with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, supplier, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Purchase orders and pagination metadata.
 */
export const fetchPurchaseOrders = async (params = {}) => {
  const response = await apiClient.get('/purchase-orders', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single purchase order by identifier.
 *
 * @param {string} id - Purchase order identifier.
 * @returns {Promise<object>} Purchase order record.
 */
export const fetchPurchaseOrderById = async (id) => {
  const response = await apiClient.get(`/purchase-orders/${id}`);
  return response.data.data;
};

/**
 * Creates a new draft purchase order.
 *
 * @param {object} payload - Purchase order creation payload.
 * @returns {Promise<object>} Created purchase order.
 */
export const createPurchaseOrder = async (payload) => {
  const response = await apiClient.post('/purchase-orders', payload);
  return response.data.data;
};

/**
 * Updates a draft purchase order.
 *
 * @param {string} id - Purchase order identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated purchase order.
 */
export const updatePurchaseOrder = async (id, payload) => {
  const response = await apiClient.patch(`/purchase-orders/${id}`, payload);
  return response.data.data;
};

/**
 * Confirms a draft purchase order to authorize supplier delivery.
 *
 * @param {string} id - Purchase order identifier.
 * @returns {Promise<object>} Confirmed purchase order.
 */
export const confirmPurchaseOrder = async (id) => {
  const response = await apiClient.post(`/purchase-orders/${id}/confirm`);
  return response.data.data;
};

/**
 * Cancels a draft or confirmed purchase order.
 *
 * @param {string} id - Purchase order identifier.
 * @returns {Promise<object>} Cancelled purchase order.
 */
export const cancelPurchaseOrder = async (id) => {
  const response = await apiClient.post(`/purchase-orders/${id}/cancel`);
  return response.data.data;
};
