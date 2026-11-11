/**
 * StockPilot WMS - Forbidden access page.
 *
 * Rendered when an authenticated user attempts to access an endpoint
 * or view outside of their granted RBAC role permissions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

/**
 * Renders the 403 Forbidden message.
 *
 * @returns {JSX.Element} Forbidden page element.
 */
const ForbiddenPage = () => (
  <section className="py-16 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
      <ShieldAlert className="h-8 w-8" aria-hidden="true" />
    </div>
    <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Access Restricted</h1>
    <p className="mt-2 text-sm text-slate-600">
      Your current role does not have authorization to view this area.
    </p>
    <Link
      to="/"
      className="mt-6 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
    >
      Return to Dashboard
    </Link>
  </section>
);

export default ForbiddenPage;
