/**
 * StockPilot WMS - Authentication provider component.
 *
 * Exposes current session state, login/logout actions, and role permission checks.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from './AuthContext.js';
import { fetchMe, loginUser, logoutUser } from './authApi.js';
import { can } from '@/lib/permissions.js';

/**
 * Global authentication provider.
 *
 * @param {{children: import('react').ReactNode}} props - Component props.
 * @returns {JSX.Element} Auth provider tree.
 */
export const AuthProvider = ({ children }) => {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loginMutation = useMutation({
    mutationFn: loginUser,
    onSuccess: (userData) => {
      queryClient.setQueryData(['auth', 'me'], userData);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  const value = useMemo(
    () => ({
      user: isError ? null : user,
      isLoading,
      isAuthenticated: Boolean(user && !isError),
      can: (permission) => can(user, permission),
      hasPermission: (permission) => can(user, permission),
      login: loginMutation.mutateAsync,
      isLoggingIn: loginMutation.isPending,
      loginError: loginMutation.error,
      logout: logoutMutation.mutateAsync,
      isLoggingOut: logoutMutation.isPending,
    }),
    [user, isLoading, isError, loginMutation, logoutMutation],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
