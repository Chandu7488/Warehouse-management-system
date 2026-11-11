/**
 * StockPilot WMS - Authentication context and hook.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/**
 * Accesses current authentication state and actions.
 *
 * @returns {object} Auth context value.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
