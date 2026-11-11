/**
 * StockPilot WMS - Main application layout.
 *
 * Renders the primary navigation, responsive sidebar, user identity summary,
 * and authenticated session controls.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Outlet, NavLink } from 'react-router-dom';
import {
  Warehouse,
  LayoutDashboard,
  Users,
  Package,
  FolderTree,
  Scale,
  Truck,
  UserCheck,
  Building,
  LogOut,
  Shield,
  Boxes,
  BookOpen,
  ShoppingCart,
  ArrowDownToLine,
  MoveDown,
  ShoppingBag,
  CheckSquare,
  PackageCheck,
  RotateCcw,
  ArrowRightLeft,
  Sliders,
  ClipboardCheck,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';

/**
 * Renders the authenticated application frame with dynamic navigation.
 *
 * @returns {JSX.Element} Layout element.
 */
const AppLayout = () => {
  const { user, can, logout, isLoggingOut } = useAuth();

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-600 font-semibold'
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between">
        <div>
          <div className="flex h-16 items-center gap-2.5 px-6 border-b border-slate-200">
            <Warehouse className="h-6 w-6 text-indigo-600" aria-hidden="true" />
            <span className="text-base font-bold tracking-tight text-slate-900">
              StockPilot WMS
            </span>
          </div>

          <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="space-y-1">
              <NavLink to="/" end className={navLinkClass}>
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                Dashboard
              </NavLink>
            </div>

            {can(PERMISSIONS.MASTER_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Master Data
                </span>
                <NavLink to="/products" className={navLinkClass}>
                  <Package className="h-4 w-4" aria-hidden="true" />
                  Products
                </NavLink>
                <NavLink to="/categories" className={navLinkClass}>
                  <FolderTree className="h-4 w-4" aria-hidden="true" />
                  Categories
                </NavLink>
                <NavLink to="/units" className={navLinkClass}>
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  Units of Measure
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.PARTNERS_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Trading Partners
                </span>
                <NavLink to="/suppliers" className={navLinkClass}>
                  <Truck className="h-4 w-4" aria-hidden="true" />
                  Suppliers
                </NavLink>
                <NavLink to="/customers" className={navLinkClass}>
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  Customers
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.WAREHOUSES_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Facilities
                </span>
                <NavLink to="/warehouses" className={navLinkClass}>
                  <Building className="h-4 w-4" aria-hidden="true" />
                  Warehouses
                </NavLink>
                <NavLink to="/locations" className={navLinkClass}>
                  <FolderTree className="h-4 w-4" aria-hidden="true" />
                  Locations &amp; Bins
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.INVENTORY_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Inventory
                </span>
                <NavLink to="/inventory" end className={navLinkClass}>
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  Stock Balances
                </NavLink>
                <NavLink to="/inventory/ledger" className={navLinkClass}>
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Stock Ledger
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.PURCHASING_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Purchasing
                </span>
                <NavLink to="/purchasing/orders" className={navLinkClass}>
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Purchase Orders
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.RECEIVING_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Inbound
                </span>
                <NavLink to="/inbound/receipts" className={navLinkClass}>
                  <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                  Goods Receipts (GRN)
                </NavLink>
                <NavLink to="/inbound/putaway" className={navLinkClass}>
                  <MoveDown className="h-4 w-4" aria-hidden="true" />
                  Putaway Tasks
                </NavLink>
              </div>
            )}

            {(can(PERMISSIONS.ORDERS_READ) || can(PERMISSIONS.PICKING_READ) || can(PERMISSIONS.SHIPPING_READ)) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Outbound
                </span>
                {can(PERMISSIONS.ORDERS_READ) && (
                  <NavLink to="/outbound/orders" className={navLinkClass}>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                    Sales Orders
                  </NavLink>
                )}
                {can(PERMISSIONS.PICKING_READ) && (
                  <NavLink to="/outbound/picking" className={navLinkClass}>
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    Wave Picking
                  </NavLink>
                )}
                {can(PERMISSIONS.SHIPPING_READ) && (
                  <NavLink to="/outbound/shipments" className={navLinkClass}>
                    <PackageCheck className="h-4 w-4" aria-hidden="true" />
                    Shipments / Dispatch
                  </NavLink>
                )}
                {(can(PERMISSIONS.RETURNS_READ) || can(PERMISSIONS.ORDERS_READ)) && (
                  <NavLink to="/returns" className={navLinkClass}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Returns &amp; RMA
                  </NavLink>
                )}
              </div>
            )}

            {can(PERMISSIONS.TRANSFERS_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Transfers &amp; Relocation
                </span>
                <NavLink to="/transfers" end className={navLinkClass}>
                  <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                  Warehouse Transfers
                </NavLink>
                <NavLink to="/transfers/replenishment" className={navLinkClass}>
                  <Sliders className="h-4 w-4" aria-hidden="true" />
                  Pick Replenishment
                </NavLink>
              </div>
            )}

            {(can(PERMISSIONS.COUNTS_READ) || can(PERMISSIONS.ADJUSTMENTS_READ)) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Stock Audits &amp; Adjustments
                </span>
                {can(PERMISSIONS.COUNTS_READ) && (
                  <NavLink to="/counts" className={navLinkClass}>
                    <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                    Cycle Counting
                  </NavLink>
                )}
                {can(PERMISSIONS.ADJUSTMENTS_READ) && (
                  <NavLink to="/adjustments" className={navLinkClass}>
                    <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                    Stock Adjustments
                  </NavLink>
                )}
              </div>
            )}

            {can(PERMISSIONS.REPORTS_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Intelligence &amp; Analytics
                </span>
                <NavLink to="/reports" className={navLinkClass}>
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Reports &amp; Analytics
                </NavLink>
              </div>
            )}

            {can(PERMISSIONS.USERS_READ) && (
              <div className="space-y-1">
                <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Administration
                </span>
                <NavLink to="/users" className={navLinkClass}>
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Users & Roles
                </NavLink>
              </div>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-400 text-center">
          v1.0.0 &middot; Production Release
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="text-xs font-medium text-slate-500 truncate">
            Enterprise Warehouse Management &amp; Inventory Control
          </div>

          {user && (
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{user.name}</span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  <Shield className="h-3 w-3 text-slate-500" aria-hidden="true" />
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={() => logout()}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {isLoggingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
