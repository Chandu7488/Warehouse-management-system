/**
 * StockPilot WMS - Executive Operations Command Center.
 *
 * Real-time executive dashboard providing financial inventory valuation,
 * outbound fulfillment throughput, inbound pipeline tracking, audit accuracy,
 * and proactive stock replenishment and expiry alerts.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  PackageCheck,
  ClipboardCheck,
  AlertTriangle,
  CalendarClock,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Boxes,
  Truck,
  Layers,
  ArrowRightLeft,
  SlidersHorizontal,
  ShoppingCart,
  ShoppingBag,
} from 'lucide-react';
import { fetchDashboardAnalytics } from '@/features/reports/reportsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Button from '@/components/ui/Button.jsx';

/**
 * Formats minor currency integer to USD string.
 *
 * @param {number} [minor=0] - Currency in cents.
 * @returns {string} Formatted dollar amount.
 */
const formatCurrency = (minor = 0) => {
  return `$${((minor || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Executive Dashboard Command Center Component.
 *
 * @returns {JSX.Element} Dashboard view.
 */
const DashboardPage = () => {
  const navigate = useNavigate();
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Fetch warehouses for warehouse switcher filter
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
    staleTime: 60000,
  });

  const warehouses = warehousesData?.items || [];

  // Fetch real-time dashboard analytics
  const {
    data: analytics,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['dashboard-analytics', selectedWarehouse],
    queryFn: () => fetchDashboardAnalytics({ warehouse: selectedWarehouse || undefined }),
    refetchInterval: 30000,
  });

  const valuation = analytics?.valuation || {
    totalQuantity: 0,
    totalReserved: 0,
    totalCostValueMinor: 0,
    totalSaleValueMinor: 0,
  };

  const inboundVelocity = analytics?.inboundVelocity || {
    openPurchaseOrders: 0,
    pendingPutaways: 0,
  };

  const outboundVelocity = analytics?.outboundVelocity || {
    ordersPending: 0,
    ordersPicking: 0,
    dispatchedToday: 0,
  };

  const audits = analytics?.audits || {
    activeCycleCounts: 0,
    pendingAdjustments: 0,
    accuracyRate: 100,
  };

  const criticalAlerts = analytics?.criticalAlerts || [];
  const expiringBatches = analytics?.expiringBatches || [];
  const activityTrend = analytics?.activityTrend || [];

  const costMinor = valuation.totalCostValueMinor || 0;
  const saleMinor = valuation.totalSaleValueMinor || 0;
  const marginPercent =
    saleMinor > 0 ? Math.round(((saleMinor - costMinor) / saleMinor) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Warehouse Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time multi-warehouse inventory valuation, throughput velocity, and audit health
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select
              id="warehouse-filter"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              options={[
                { value: '', label: 'All Warehouses' },
                ...warehouses.map((w) => ({
                  value: w.id || w._id,
                  label: `${w.code} - ${w.name}`,
                })),
              ]}
            />
          </div>

          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-500 ${isRefetching ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/reports')}
            className="flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Reports Hub</span>
          </Button>
        </div>
      </div>

      {/* Quick Action Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
        <span className="font-semibold text-slate-600 px-2 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-indigo-600" />
          Quick Actions:
        </span>
        <Link
          to="/purchasing/orders"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
        >
          <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
          Purchase Orders
        </Link>
        <Link
          to="/outbound/orders"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
        >
          <ShoppingBag className="h-3.5 w-3.5 text-blue-500" />
          Sales Orders
        </Link>
        <Link
          to="/transfers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500" />
          Warehouse Transfers
        </Link>
        <Link
          to="/counts"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
        >
          <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" />
          Cycle Counts
        </Link>
        <Link
          to="/adjustments"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:border-indigo-400 hover:text-indigo-600 transition-colors shadow-2xs"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-rose-500" />
          Stock Adjustments
        </Link>
        <Link
          to="/reports"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium hover:bg-indigo-100 transition-colors ml-auto"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Financial &amp; Turnover Analytics &rarr;
        </Link>
      </div>

      {/* Top 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Valuation */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Stock Valuation
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(costMinor)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Badge variant="success">+{marginPercent}% Margin</Badge>
              <span className="text-slate-500">Retail: {formatCurrency(saleMinor)}</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>On Hand: {valuation.totalQuantity.toLocaleString()} units</span>
            <span className="text-amber-600 font-medium">
              {valuation.totalReserved.toLocaleString()} reserved
            </span>
          </div>
        </div>

        {/* KPI 2: Outbound Fulfillment */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fulfillment Throughput
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {outboundVelocity.dispatchedToday} Dispatched
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-blue-600">
                {outboundVelocity.ordersPicking} in Picking
              </span>
              <span>&bull;</span>
              <span>{outboundVelocity.ordersPending} pending release</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/outbound/shipments"
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              View Dispatch Ledger <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* KPI 3: Inbound Pipeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Inbound Pipeline
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {inboundVelocity.openPurchaseOrders} Active POs
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Badge variant={inboundVelocity.pendingPutaways > 0 ? 'warning' : 'neutral'}>
                {inboundVelocity.pendingPutaways} Putaways Pending
              </Badge>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/inbound/putaway"
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              Manage Putaway Tasks <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* KPI 4: Inventory Accuracy & Audits */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Inventory Accuracy
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-slate-900">
              {audits.accuracyRate}% Match Rate
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <span>{audits.activeCycleCounts} Active Counts</span>
              <span>&bull;</span>
              <span>{audits.pendingAdjustments} Adjustments</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/counts"
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              Audit Cycle Counts <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Split: Critical Stock Alerts vs Expiring Batches */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel 1: Critical Stock Alerts (Below Reorder Point) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-rose-50 p-1.5 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Critical Stock Alerts</h2>
            </div>
            <Badge variant={criticalAlerts.length > 0 ? 'danger' : 'success'}>
              {criticalAlerts.length} Deficit Items
            </Badge>
          </div>

          <div className="flex-1 p-6">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
                Analyzing inventory levels against safety thresholds...
              </div>
            ) : criticalAlerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <Boxes className="mx-auto h-8 w-8 text-emerald-500 mb-2 opacity-60" />
                <p className="font-medium text-slate-700">Healthy Inventory Levels</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  All active SKUs meet or exceed established reorder levels.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-2">SKU / Item</th>
                      <th className="pb-2 text-right">On Hand</th>
                      <th className="pb-2 text-right">Reorder Level</th>
                      <th className="pb-2 text-right">Deficit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {criticalAlerts.map((item) => {
                      const deficit = Math.max(0, (item.reorderLevel || 0) - (item.totalOnHand || 0));
                      return (
                        <tr key={item._id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 pr-2">
                            <span className="font-mono font-semibold text-indigo-600 block">
                              {item.sku}
                            </span>
                            <span className="text-slate-600 truncate block max-w-xs">
                              {item.name}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-medium text-rose-600">
                            {item.totalOnHand}
                          </td>
                          <td className="py-2.5 text-right text-slate-500 font-medium">
                            {item.reorderLevel}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700">
                              -{deficit}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 rounded-b-xl flex items-center justify-between text-xs">
            <span className="text-slate-500">Auto-calculated from SKU reorder triggers</span>
            <Link
              to="/purchasing/orders"
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              Draft Purchase Orders &rarr;
            </Link>
          </div>
        </div>

        {/* Panel 2: Batch Shelf-Life Expiry Warnings (< 30 Days) */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                <CalendarClock className="h-4 w-4" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">
                Expiring Batches (&lt; 30 Days)
              </h2>
            </div>
            <Badge variant={expiringBatches.length > 0 ? 'warning' : 'neutral'}>
              {expiringBatches.length} Batches
            </Badge>
          </div>

          <div className="flex-1 p-6">
            {isLoading ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">
                Scanning active batch lot expiry registers...
              </div>
            ) : expiringBatches.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                <CalendarClock className="mx-auto h-8 w-8 text-slate-400 mb-2 opacity-60" />
                <p className="font-medium text-slate-700">No Imminent Expirations</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  All active batch stock lots have comfortable shelf life (&gt; 30 days).
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-2">Batch / SKU</th>
                      <th className="pb-2">Product Name</th>
                      <th className="pb-2 text-right">Expires On</th>
                      <th className="pb-2 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiringBatches.map((b, idx) => (
                      <tr key={b.batchNumber || idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono font-semibold text-slate-900 block">
                            {b.batchNumber}
                          </span>
                          <span className="text-indigo-600 font-mono text-[11px] block">
                            {b.sku}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 truncate max-w-xs">{b.name}</td>
                        <td className="py-2.5 text-right font-medium text-slate-700">
                          {b.expiresOn ? new Date(b.expiresOn).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge variant={b.daysRemaining <= 7 ? 'danger' : 'warning'}>
                            {b.daysRemaining} days
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 rounded-b-xl flex items-center justify-between text-xs">
            <span className="text-slate-500">FEFO priority allocation active</span>
            <Link
              to="/reports"
              className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
            >
              Full Batch Aging Report &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* 7-Day Activity Trend Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              7-Day Stock Movement Velocity Activity
            </h3>
          </div>
          <span className="text-xs text-slate-400">Ledger transaction volume</span>
        </div>

        {activityTrend.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">
            No stock ledger movements recorded within the last 7 days.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {activityTrend.map((entry, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-center"
              >
                <div className="text-[11px] font-semibold text-slate-500">
                  {entry._id?.date || 'Day'}
                </div>
                <div
                  className={`text-sm font-bold mt-1 ${
                    entry._id?.isPositive ? 'text-emerald-600' : 'text-slate-800'
                  }`}
                >
                  {entry.totalQuantity > 0 ? `+${entry.totalQuantity}` : entry.totalQuantity}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{entry.count} txns</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
