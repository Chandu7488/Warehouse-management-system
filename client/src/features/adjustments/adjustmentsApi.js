/**
 * StockPilot WMS - Stock Adjustments API Client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated stock adjustments.
 *
 * @param {object} [params={}] - Filter and pagination params.
 * @returns {Promise<{items: Array<object>, meta: object}>} Adjustments list and meta.
 */
export const fetchAdjustments = async (params = {}) => {
  const response = await apiClient.get('/adjustments', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single stock adjustment by identifier.
 *
 * @param {string} id - Adjustment ID.
 * @returns {Promise<object>} Stock adjustment document.
 */
export const fetchAdjustmentById = async (id) => {
  const response = await apiClient.get(`/adjustments/${id}`);
  return response.data.data;
};

/**
 * Creates a direct stock adjustment or write-off proposal.
 *
 * @param {object} payload - Adjustment data.
 * @returns {Promise<object>} Created adjustment document.
 */
export const createAdjustment = async (payload) => {
  const response = await apiClient.post('/adjustments', payload);
  return response.data.data;
};

/**
 * Approves a proposed stock adjustment and posts ledger movements.
 *
 * @param {string} id - Adjustment ID.
 * @param {object} [payload={}] - Approval notes.
 * @returns {Promise<object>} Approved adjustment.
 */
export const approveAdjustment = async (id, payload = {}) => {
  const response = await apiClient.post(`/adjustments/${id}/approve`, payload);
  return response.data.data;
};

/**
 * Rejects a proposed stock adjustment.
 *
 * @param {string} id - Adjustment ID.
 * @param {object} [payload={}] - Rejection reason.
 * @returns {Promise<object>} Rejected adjustment.
 */
export const rejectAdjustment = async (id, payload = {}) => {
  const response = await apiClient.post(`/adjustments/${id}/reject`, payload);
  return response.data.data;
};
