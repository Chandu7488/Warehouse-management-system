/**
 * StockPilot WMS - Inventory API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated list of stock balances with optional warehouse, category, or product filters.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Stock balances and pagination meta.
 */
export const fetchBalances = async (params = {}) => {
  const response = await apiClient.get('/inventory/balances', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches paginated stock ledger history entries.
 *
 * @param {object} [params={}] - Query filters (movementType, warehouse, product, date range).
 * @returns {Promise<{items: Array<object>, meta: object}>} Ledger entries and pagination meta.
 */
export const fetchLedgerEntries = async (params = {}) => {
  const response = await apiClient.get('/inventory/ledger', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches real-time stock availability for a product in a warehouse.
 *
 * @param {object} params - Criteria with warehouse and product identifiers.
 * @returns {Promise<object>} Availability statistics and location breakdown.
 */
export const fetchAvailability = async (params) => {
  const response = await apiClient.get('/inventory/availability', { params });
  return response.data.data;
};

/**
 * Fetches comprehensive stock details for a product across all warehouses.
 *
 * @param {string} productId - Product identifier.
 * @returns {Promise<Array<object>>} List of stock balance entries.
 */
export const fetchProductStock = async (productId) => {
  const response = await apiClient.get(`/products/${productId}/stock`);
  return response.data.data;
};

/**
 * Posts initial opening stock balances for a warehouse.
 *
 * @param {object} payload - Opening stock submission payload.
 * @returns {Promise<Array<object>>} Created stock ledger entries.
 */
export const postOpeningBalance = async (payload) => {
  const response = await apiClient.post('/inventory/opening-balance', payload);
  return response.data.data;
};

/**
 * Reverses an erroneous stock ledger entry.
 *
 * @param {string} entryId - Target ledger entry identifier.
 * @param {object} payload - Reason descriptor for audit log.
 * @returns {Promise<object>} Reversal ledger entry.
 */
export const reverseLedgerEntry = async (entryId, payload) => {
  const response = await apiClient.post(`/inventory/ledger/${entryId}/reverse`, payload);
  return response.data.data;
};

/**
 * Fetches list of lots and batches with optional filters.
 *
 * @param {object} [params={}] - Query filters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Batches and pagination meta.
 */
export const fetchBatches = async (params = {}) => {
  const response = await apiClient.get('/batches', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Creates a new batch record.
 *
 * @param {object} payload - Batch creation payload.
 * @returns {Promise<object>} Created batch.
 */
export const createBatch = async (payload) => {
  const response = await apiClient.post('/batches', payload);
  return response.data.data;
};

/**
 * Updates a batch status (ACTIVE, QUARANTINED, RECALLED).
 *
 * @param {string} id - Batch identifier.
 * @param {object} payload - Update payload with status.
 * @returns {Promise<object>} Updated batch.
 */
export const updateBatchStatus = async (id, payload) => {
  const response = await apiClient.patch(`/batches/${id}`, payload);
  return response.data.data;
};
