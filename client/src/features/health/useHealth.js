/**
 * StockPilot WMS - Health query hook.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/features/health/healthApi.js';

/**
 * Queries the API health endpoint.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult} Query result.
 */
export const useHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: fetchHealth, staleTime: 0 });
