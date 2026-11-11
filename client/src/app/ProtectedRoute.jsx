/**
 * StockPilot WMS - Protected route boundary.
 *
 * Enforces session authentication and optional RBAC permission requirements
 * before granting access to nested route components.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.js';

/**
 * Route guard component for authenticated and authorized pages.
 *
 * @param {object} props - Component properties.
 * @param {string} [props.permission] - Optional permission required.
 * @param {import('react').ReactNode} [props.children] - Optional custom children.
 * @returns {JSX.Element} Protected component or redirect.
 */
export const ProtectedRoute = ({ permission, children }) => {
  const { isAuthenticated, isLoading, can: userCan } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm font-medium">Loading session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !userCan(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
