/**
 * StockPilot WMS - Products API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches paginated products with optional filters.
 *
 * @param {object} [params={}] - Query parameters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Products list and meta.
 */
export const fetchProducts = async (params = {}) => {
  const response = await apiClient.get('/products', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

/**
 * Fetches a single product by identifier.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object>} Product record.
 */
export const fetchProductById = async (id) => {
  const response = await apiClient.get(`/products/${id}`);
  return response.data.data;
};

/**
 * Creates a new product catalog item.
 *
 * @param {object} payload - Product payload.
 * @returns {Promise<object>} Created product.
 */
export const createProduct = async (payload) => {
  const response = await apiClient.post('/products', payload);
  return response.data.data;
};

/**
 * Updates an existing product catalog item.
 *
 * @param {string} id - Product identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated product.
 */
export const updateProduct = async (id, payload) => {
  const response = await apiClient.patch(`/products/${id}`, payload);
  return response.data.data;
};

/**
 * Deactivates an existing product catalog item.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object>} Deactivated product.
 */
export const deactivateProduct = async (id) => {
  const response = await apiClient.delete(`/products/${id}`);
  return response.data.data;
};

/**
 * Fetches inventory stock summary for a product across warehouses.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object>} Product stock levels.
 */
export const fetchProductStock = async (id) => {
  const response = await apiClient.get(`/products/${id}/stock`);
  return response.data.data;
};

/**
 * Looks up a product by exact barcode or SKU code.
 *
 * @param {string} code - Barcode or SKU code.
 * @returns {Promise<object>} Matching product details.
 */
export const lookupProductByCode = async (code) => {
  const response = await apiClient.get('/products/lookup', { params: { code } });
  return response.data.data;
};
