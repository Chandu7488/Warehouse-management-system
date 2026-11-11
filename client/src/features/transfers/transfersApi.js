/**
 * StockPilot WMS - Transfers & Replenishment API Client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated transfer orders with optional filtering.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Orders and pagination metadata.
 */
export const fetchTransferOrders = async (params = {}) => {
  const response = await apiClient.get('/transfers', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single transfer order by identifier.
 *
 * @param {string} id - Transfer order ID.
 * @returns {Promise<object>} Transfer order document.
 */
export const fetchTransferOrderById = async (id) => {
  const response = await apiClient.get(`/transfers/${id}`);
  return response.data.data;
};

/**
 * Creates a new transfer order.
 *
 * @param {object} payload - Creation payload.
 * @returns {Promise<object>} Created transfer order.
 */
export const createTransferOrder = async (payload) => {
  const response = await apiClient.post('/transfers', payload);
  return response.data.data;
};

/**
 * Dispatches a transfer order from the origin facility.
 *
 * @param {string} id - Transfer order ID.
 * @param {object} payload - Dispatch metadata.
 * @returns {Promise<object>} Updated transfer order.
 */
export const dispatchTransferOrder = async (id, payload) => {
  const response = await apiClient.post(`/transfers/${id}/dispatch`, payload);
  return response.data.data;
};

/**
 * Receives transfer order lines at the destination facility.
 *
 * @param {string} id - Transfer order ID.
 * @param {object} payload - Received items with destination bins.
 * @returns {Promise<object>} Updated transfer order.
 */
export const receiveTransferOrder = async (id, payload) => {
  const response = await apiClient.post(`/transfers/${id}/receive`, payload);
  return response.data.data;
};

/**
 * Cancels a pending transfer order.
 *
 * @param {string} id - Transfer order ID.
 * @param {string} [reason=''] - Cancellation rationale.
 * @returns {Promise<object>} Cancelled transfer order.
 */
export const cancelTransferOrder = async (id, reason = '') => {
  const response = await apiClient.post(`/transfers/${id}/cancel`, { reason });
  return response.data.data;
};

/**
 * Executes an instant atomic direct bin relocation within a warehouse.
 *
 * @param {object} payload - Relocation payload.
 * @returns {Promise<object>} Execution result.
 */
export const executeDirectBinTransfer = async (payload) => {
  const response = await apiClient.post('/transfers/direct', payload);
  return response.data.data;
};

/**
 * Lists configured replenishment rules.
 *
 * @param {object} [params={}] - Query filters.
 * @returns {Promise<Array<object>>} List of configured min/max rules.
 */
export const fetchReplenishmentRules = async (params = {}) => {
  const response = await apiClient.get('/transfers/replenishment/rules', { params });
  return response.data.data;
};

/**
 * Creates or updates a replenishment rule.
 *
 * @param {object} payload - Rule payload.
 * @returns {Promise<object>} Saved rule.
 */
export const upsertReplenishmentRule = async (payload) => {
  const response = await apiClient.post('/transfers/replenishment/rules', payload);
  return response.data.data;
};

/**
 * Evaluates replenishment deficits and reserve availability for a warehouse.
 *
 * @param {string} [warehouseId] - Warehouse ID.
 * @returns {Promise<Array<object>>} Deficit recommendations.
 */
export const evaluateReplenishmentNeeds = async (warehouseId) => {
  const url = warehouseId
    ? `/transfers/replenishment/evaluate/${warehouseId}`
    : '/transfers/replenishment/evaluate';
  const response = await apiClient.get(url);
  return response.data.data;
};
