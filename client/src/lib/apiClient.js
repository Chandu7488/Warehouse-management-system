/**
 * StockPilot WMS - Axios API client.
 *
 * Sends cookies with every request, converts server error envelopes into
 * ApiClientError instances, and transparently refreshes expired access tokens.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import axios from 'axios';

const REQUEST_TIMEOUT_MS = 15000;

export class ApiClientError extends Error {
  /**
   * @param {object} options - Error options.
   * @param {number} [options.status] - HTTP status code.
   * @param {string} options.code - Machine readable error code.
   * @param {string} options.message - Human readable message.
   * @param {unknown} [options.details] - Field level details.
   */
  constructor({ status, code, message, details }) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isUnauthorized = error.response?.status === 401;
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (isUnauthorized && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        await apiClient.post('/auth/refresh');
        return apiClient(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    const payload = error.response?.data?.error;
    return Promise.reject(
      new ApiClientError({
        status: error.response?.status,
        code: payload?.code ?? 'NETWORK_ERROR',
        message: payload?.message ?? 'Unable to reach the server',
        details: payload?.details,
      }),
    );
  },
);
