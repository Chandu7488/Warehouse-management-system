/**
 * StockPilot WMS - Wave / Pick Lists API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated pick lists with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Pick lists and pagination meta.
 */
export const fetchPickLists = async (params = {}) => {
  const response = await apiClient.get('/pick-lists', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single pick list by identifier.
 *
 * @param {string} id - Pick list identifier.
 * @returns {Promise<object>} Populated pick list document.
 */
export const fetchPickListById = async (id) => {
  const response = await apiClient.get(`/pick-lists/${id}`);
  return response.data.data;
};

/**
 * Creates a new pick list / wave for selected sales orders.
 *
 * @param {object} payload - Creation payload (warehouse, salesOrderIds, stagingLocationId, assignedTo).
 * @returns {Promise<object>} Created pick list.
 */
export const createPickList = async (payload) => {
  const response = await apiClient.post('/pick-lists', payload);
  return response.data.data;
};

/**
 * Starts execution of a pick list.
 *
 * @param {string} id - Pick list identifier.
 * @returns {Promise<object>} In-progress pick list.
 */
export const startPickList = async (id) => {
  const response = await apiClient.post(`/pick-lists/${id}/start`);
  return response.data.data;
};

/**
 * Confirms picking of an item line.
 *
 * @param {string} pickListId - Pick list identifier.
 * @param {string} itemId - Item line identifier.
 * @param {object} payload - Confirmation payload (pickedQty, batch, serialNumbers).
 * @returns {Promise<object>} Updated pick list.
 */
export const confirmPickItem = async (pickListId, itemId, payload) => {
  const response = await apiClient.post(`/pick-lists/${pickListId}/items/${itemId}/confirm`, payload);
  return response.data.data;
};

/**
 * Cancels a pending or in-progress pick list.
 *
 * @param {string} id - Pick list identifier.
 * @returns {Promise<object>} Cancelled pick list.
 */
export const cancelPickList = async (id) => {
  const response = await apiClient.post(`/pick-lists/${id}/cancel`);
  return response.data.data;
};
