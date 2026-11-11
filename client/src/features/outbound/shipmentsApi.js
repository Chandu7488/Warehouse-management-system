/**
 * StockPilot WMS - Outbound Shipments API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated outbound shipments with optional filtering.
 *
 * @param {object} [params={}] - Query parameters (warehouse, salesOrder, status, search, page, limit).
 * @returns {Promise<{items: Array<object>, meta: object}>} Shipments and pagination meta.
 */
export const fetchShipments = async (params = {}) => {
  const response = await apiClient.get('/shipments', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single shipment by identifier.
 *
 * @param {string} id - Shipment identifier.
 * @returns {Promise<object>} Populated shipment document.
 */
export const fetchShipmentById = async (id) => {
  const response = await apiClient.get(`/shipments/${id}`);
  return response.data.data;
};

/**
 * Creates a new shipment for an allocated or packed sales order.
 *
 * @param {object} payload - Creation payload (salesOrder, carrier, trackingNumber, packages).
 * @returns {Promise<object>} Created shipment.
 */
export const createShipment = async (payload) => {
  const response = await apiClient.post('/shipments', payload);
  return response.data.data;
};

/**
 * Dispatches a shipment, updates tracking, and posts SALES_ISSUE to stock ledger.
 *
 * @param {string} id - Shipment identifier.
 * @param {object} payload - Dispatch parameters (carrier, trackingNumber, notes).
 * @returns {Promise<object>} Dispatched shipment.
 */
export const dispatchShipment = async (id, payload) => {
  const response = await apiClient.post(`/shipments/${id}/dispatch`, payload);
  return response.data.data;
};
