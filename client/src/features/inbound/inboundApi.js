/**
 * StockPilot WMS - Inbound Operations API client.
 *
 * Handles Goods Receipts Notes (GRN) and Directed Putaway Task endpoints.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated goods receipts with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, supplier, purchaseOrder, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Goods receipts and pagination meta.
 */
export const fetchGoodsReceipts = async (params = {}) => {
  const response = await apiClient.get('/goods-receipts', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single goods receipt by identifier.
 *
 * @param {string} id - Goods receipt identifier.
 * @returns {Promise<object>} Goods receipt document.
 */
export const fetchGoodsReceiptById = async (id) => {
  const response = await apiClient.get(`/goods-receipts/${id}`);
  return response.data.data;
};

/**
 * Records inbound goods receipt at dock and creates putaway tasks.
 *
 * @param {object} payload - Goods receipt payload.
 * @returns {Promise<object>} Created goods receipt document.
 */
export const createGoodsReceipt = async (payload) => {
  const response = await apiClient.post('/goods-receipts', payload);
  return response.data.data;
};

/**
 * Updates QA inspection outcome on a goods receipt.
 *
 * @param {string} id - Goods receipt identifier.
 * @param {object} payload - Inspection outcome payload.
 * @returns {Promise<object>} Updated goods receipt.
 */
export const inspectGoodsReceipt = async (id, payload) => {
  const response = await apiClient.post(`/goods-receipts/${id}/inspect`, payload);
  return response.data.data;
};

/**
 * Fetches paginated directed putaway tasks with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, product, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Putaway tasks and pagination meta.
 */
export const fetchPutawayTasks = async (params = {}) => {
  const response = await apiClient.get('/putaway-tasks', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single putaway task by identifier.
 *
 * @param {string} id - Task identifier.
 * @returns {Promise<object>} Task document.
 */
export const fetchPutawayTaskById = async (id) => {
  const response = await apiClient.get(`/putaway-tasks/${id}`);
  return response.data.data;
};

/**
 * Re-determines suggested optimal putaway storage location for a product.
 *
 * @param {object} params - Warehouse and product parameters.
 * @returns {Promise<object>} Suggested location.
 */
export const fetchSuggestedPutawayLocation = async (params) => {
  const response = await apiClient.get('/putaway-tasks/suggest-location', { params });
  return response.data.data;
};

/**
 * Executes putaway stock transfer from receiving dock to destination storage bin.
 *
 * @param {string} id - Task identifier.
 * @param {object} payload - Completion payload (destinationLocation, notes).
 * @returns {Promise<object>} Completed putaway task.
 */
export const completePutawayTask = async (id, payload) => {
  const response = await apiClient.post(`/putaway-tasks/${id}/complete`, payload);
  return response.data.data;
};

/**
 * Cancels a pending putaway task.
 *
 * @param {string} id - Task identifier.
 * @returns {Promise<object>} Cancelled task.
 */
export const cancelPutawayTask = async (id) => {
  const response = await apiClient.post(`/putaway-tasks/${id}/cancel`);
  return response.data.data;
};
