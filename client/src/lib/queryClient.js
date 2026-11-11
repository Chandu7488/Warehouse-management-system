/**
 * StockPilot WMS - TanStack Query client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { QueryClient } from '@tanstack/react-query';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_RETRIES = 1;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      retry: MAX_RETRIES,
      refetchOnWindowFocus: false,
    },
  },
});
