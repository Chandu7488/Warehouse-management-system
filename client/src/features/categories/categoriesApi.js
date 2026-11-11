/**
 * StockPilot WMS - Category API client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

export const fetchCategories = async (params = {}) => {
  const response = await apiClient.get('/categories', { params });
  return {
    items: response.data.data,
    meta: response.data.meta,
  };
};

export const createCategory = async (payload) => {
  const response = await apiClient.post('/categories', payload);
  return response.data.data;
};

export const updateCategory = async (id, payload) => {
  const response = await apiClient.patch(`/categories/${id}`, payload);
  return response.data.data;
};

export const deactivateCategory = async (id) => {
  const response = await apiClient.delete(`/categories/${id}`);
  return response.data.data;
};
