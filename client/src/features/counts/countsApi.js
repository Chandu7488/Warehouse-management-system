/**
 * StockPilot WMS - Cycle Counting API Client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated cycle count sessions.
 *
 * @param {object} [params={}] - Filter and pagination params.
 * @returns {Promise<{items: Array<object>, meta: object}>} Cycle counts.
 */
export const fetchCycleCounts = async (params = {}) => {
  const response = await apiClient.get('/counts', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single cycle count session by identifier.
 *
 * @param {string} id - Cycle count ID.
 * @returns {Promise<object>} Cycle count session document.
 */
export const fetchCycleCountById = async (id) => {
  const response = await apiClient.get(`/counts/${id}`);
  return response.data.data;
};

/**
 * Creates a new cycle count plan.
 *
 * @param {object} payload - Count parameters.
 * @returns {Promise<object>} Created count order.
 */
export const createCycleCountPlan = async (payload) => {
  const response = await apiClient.post('/counts', payload);
  return response.data.data;
};

/**
 * Starts a cycle count session and freezes inventory snapshot.
 *
 * @param {string} id - Cycle count ID.
 * @returns {Promise<object>} Started cycle count order.
 */
export const startCycleCount = async (id) => {
  const response = await apiClient.post(`/counts/${id}/start`);
  return response.data.data;
};

/**
 * Submits physical count results.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} payload - Items containing counted quantities.
 * @returns {Promise<object>} Updated cycle count order.
 */
export const submitCountResults = async (id, payload) => {
  const response = await apiClient.post(`/counts/${id}/submit`, payload);
  return response.data.data;
};

/**
 * Requests a recount for specific items with variances.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} payload - Item IDs to recount.
 * @returns {Promise<object>} Updated count order.
 */
export const requestRecount = async (id, payload) => {
  const response = await apiClient.post(`/counts/${id}/recount`, payload);
  return response.data.data;
};

/**
 * Reconciles inventory discrepancies into the stock ledger.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} [payload={}] - Reconciliation notes.
 * @returns {Promise<object>} Reconciled count order.
 */
export const reconcileCycleCount = async (id, payload = {}) => {
  const response = await apiClient.post(`/counts/${id}/reconcile`, payload);
  return response.data.data;
};

/**
 * Aborts a cycle count session.
 *
 * @param {string} id - Cycle count ID.
 * @param {object} [payload={}] - Reason for cancellation.
 * @returns {Promise<object>} Cancelled count order.
 */
export const cancelCycleCount = async (id, payload = {}) => {
  const response = await apiClient.post(`/counts/${id}/cancel`, payload);
  return response.data.data;
};
