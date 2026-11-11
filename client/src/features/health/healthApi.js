/**
 * StockPilot WMS - Health API functions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches the API health status.
 *
 * @returns {Promise<{status: string, uptimeSeconds: number, timestamp: string, database: string}>} Health data.
 */
export const fetchHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data.data;
};
