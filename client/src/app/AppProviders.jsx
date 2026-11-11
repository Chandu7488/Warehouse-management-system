/**
 * StockPilot WMS - Global context providers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient.js';
import { AuthProvider } from '@/features/auth/AuthProvider.jsx';

/**
 * Wraps the application with shared providers.
 *
 * @param {{children: import('react').ReactNode}} props - Component props.
 * @returns {JSX.Element} Provider tree.
 */
const AppProviders = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

export default AppProviders;
