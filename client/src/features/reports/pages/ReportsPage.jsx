/**
 * StockPilot WMS - Dedicated Analytics & Reports Hub.
 *
 * Provides executive financial valuation, inventory turnover velocity,
 * batch shelf-life aging, and discrepancy & shrinkage audit reporting
 * with multi-warehouse filtering and RFC 4180 CSV spreadsheet export.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  CalendarClock,
  AlertOctagon,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  fetchValuationReport,
  fetchTurnoverReport,
  fetchAgingReport,
  fetchDiscrepancyReport,
  downloadReportCsv,
} from '../reportsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchCategories } from '@/features/categories/categoriesApi.js';
import Button from '@/components/ui/Button.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

/**
 * Formats minor currency integer to USD string.
 *
 * @param {number} [minor=0] - Amount in cents.
 * @returns {string} Formatted dollar amount.
 */
const formatCurrency = (minor = 0) => {
  return `$${((minor || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const REPORT_TABS = [
  { id: 'valuation', label: 'Valuation & Assets', icon: DollarSign },
  { id: 'turnover', label: 'Turnover & Velocity', icon: TrendingUp },
  { id: 'aging', label: 'Batch Expiry & Aging', icon: CalendarClock },
  { id: 'discrepancy', label: 'Discrepancies & Shrinkage', icon: AlertOctagon },
];

/**
 * Reports Hub Page Component.
 *
 * @returns {JSX.Element} Reports hub view.
 */
const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('valuation');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Load Warehouses for filter
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-filter'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
    staleTime: 60000,
  });
  const warehouses = warehousesData?.items || [];

  // Load Categories for filter
  const { data: categoriesData } = useQuery({
    queryKey: ['categories-filter'],
    queryFn: () => fetchCategories({ limit: 100 }),
    staleTime: 60000,
  });
  const categories = categoriesData?.items || [];

  // Query: Valuation Report
  const {
    data: valuationData,
    isLoading: isValuationLoading,
    refetch: refetchValuation,
    isRefetching: isValuationRefetching,
  } = useQuery({
    queryKey: ['report-valuation', warehouseFilter, categoryFilter],
    queryFn: () =>
      fetchValuationReport({
        warehouse: warehouseFilter || undefined,
        category: categoryFilter || undefined,
      }),
    enabled: activeTab === 'valuation',
  });

  // Query: Turnover Report
  const {
    data: turnoverData,
    isLoading: isTurnoverLoading,
    refetch: refetchTurnover,
    isRefetching: isTurnoverRefetching,
  } = useQuery({
    queryKey: ['report-turnover', warehouseFilter, daysFilter],
    queryFn: () =>
      fetchTurnoverReport({
        warehouse: warehouseFilter || undefined,
        days: daysFilter ? Number(daysFilter) : 30,
      }),
    enabled: activeTab === 'turnover',
  });

  // Query: Aging Report
  const {
    data: agingData,
    isLoading: isAgingLoading,
    refetch: refetchAging,
    isRefetching: isAgingRefetching,
  } = useQuery({
    queryKey: ['report-aging', warehouseFilter, categoryFilter],
    queryFn: () =>
      fetchAgingReport({
        warehouse: warehouseFilter || undefined,
        category: categoryFilter || undefined,
      }),
    enabled: activeTab === 'aging',
  });

  // Query: Discrepancy Report
  const {
    data: discrepancyData,
    isLoading: isDiscrepancyLoading,
    refetch: refetchDiscrepancy,
    isRefetching: isDiscrepancyRefetching,
  } = useQuery({
    queryKey: ['report-discrepancy', warehouseFilter],
    queryFn: () =>
      fetchDiscrepancyReport({
        warehouse: warehouseFilter || undefined,
      }),
    enabled: activeTab === 'discrepancy',
  });

  const isLoading =
    (activeTab === 'valuation' && isValuationLoading) ||
    (activeTab === 'turnover' && isTurnoverLoading) ||
    (activeTab === 'aging' && isAgingLoading) ||
    (activeTab === 'discrepancy' && isDiscrepancyLoading);

  const isRefetching =
    (activeTab === 'valuation' && isValuationRefetching) ||
    (activeTab === 'turnover' && isTurnoverRefetching) ||
    (activeTab === 'aging' && isAgingRefetching) ||
    (activeTab === 'discrepancy' && isDiscrepancyRefetching);

  const handleRefresh = () => {
    if (activeTab === 'valuation') {
      refetchValuation();
    } else if (activeTab === 'turnover') {
      refetchTurnover();
    } else if (activeTab === 'aging') {
      refetchAging();
    } else if (activeTab === 'discrepancy') {
      refetchDiscrepancy();
    }
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const params = {};
      if (warehouseFilter) {
        params.warehouse = warehouseFilter;
      }
      if (categoryFilter && (activeTab === 'valuation' || activeTab === 'aging')) {
        params.category = categoryFilter;
      }
      if (daysFilter && activeTab === 'turnover') {
        params.days = daysFilter;
      }
      await downloadReportCsv(activeTab, params);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filter items by client search query
  const filterBySearch = (items = [], fields = ['sku', 'name', 'productName']) => {
    if (!searchQuery.trim()) {
      return items;
    }
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) =>
      fields.some((field) => item[field]?.toString().toLowerCase().includes(q)),
    );
  };

  // Columns for Valuation Report
  const valuationColumns = [
    {
      header: 'SKU / Product',
      key: 'sku',
      render: (row) => (
        <div>
          <span className="font-mono font-semibold text-indigo-600 block">{row.sku}</span>
          <span className="text-slate-600 truncate block max-w-xs">{row.name}</span>
        </div>
      ),
    },
    { header: 'Category', key: 'categoryName', render: (row) => row.categoryName || '—' },
    {
      header: 'Warehouse',
      key: 'warehouseCode',
      render: (row) => (
        <span className="font-mono text-xs">{row.warehouseCode || '—'}</span>
      ),
    },
    {
      header: 'On Hand',
      key: 'onHand',
      className: 'text-right',
      render: (row) => <span className="font-semibold">{row.onHand?.toLocaleString()}</span>,
    },
    {
      header: 'Reserved',
      key: 'reserved',
      className: 'text-right',
      render: (row) => (
        <span className={row.reserved > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
          {row.reserved?.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Available',
      key: 'available',
      className: 'text-right',
      render: (row) => <span className="font-medium text-emerald-600">{row.available?.toLocaleString()}</span>,
    },
    {
      header: 'Unit Cost',
      key: 'costPriceMinor',
      className: 'text-right',
      render: (row) => formatCurrency(row.costPriceMinor),
    },
    {
      header: 'Total Cost Value',
      key: 'totalCostMinor',
      className: 'text-right font-medium text-slate-900',
      render: (row) => formatCurrency(row.totalCostMinor),
    },
    {
      header: 'Retail Value',
      key: 'totalSaleMinor',
      className: 'text-right text-slate-600',
      render: (row) => formatCurrency(row.totalSaleMinor),
    },
    {
      header: 'Margin %',
      key: 'marginMinor',
      className: 'text-right',
      render: (row) => {
        const pct =
          row.totalSaleMinor > 0
            ? Math.round((row.marginMinor / row.totalSaleMinor) * 100)
            : 0;
        return (
          <Badge variant={pct > 20 ? 'success' : 'neutral'}>
            {pct}%
          </Badge>
        );
      },
    },
  ];

  // Columns for Turnover Report
  const turnoverColumns = [
    {
      header: 'SKU / Product',
      key: 'sku',
      render: (row) => (
        <div>
          <span className="font-mono font-semibold text-indigo-600 block">{row.sku}</span>
          <span className="text-slate-600 truncate block max-w-xs">{row.name}</span>
        </div>
      ),
    },
    { header: 'Category', key: 'categoryName', render: (row) => row.categoryName || '—' },
    {
      header: 'Current Stock',
      key: 'onHand',
      className: 'text-right',
      render: (row) => row.onHand?.toLocaleString(),
    },
    {
      header: 'Units Sold (Outbound)',
      key: 'issuedQty',
      className: 'text-right font-semibold text-slate-900',
      render: (row) => row.issuedQty?.toLocaleString(),
    },
    {
      header: 'Daily Velocity',
      key: 'dailyVelocity',
      className: 'text-right',
      render: (row) => {
        const days = turnoverData?.summary?.timeWindowDays || 30;
        const velocity = (row.issuedQty / days).toFixed(2);
        return `${velocity} / day`;
      },
    },
    {
      header: 'Turnover Ratio',
      key: 'turnoverRatio',
      className: 'text-right font-mono font-medium',
      render: (row) => `${row.turnoverRatio}x`,
    },
    {
      header: 'Classification',
      key: 'velocity',
      render: (row) => {
        const variants = {
          FAST_MOVING: 'success',
          MEDIUM_MOVING: 'info',
          SLOW_MOVING: 'warning',
          DEAD_STOCK: 'danger',
        };
        const labels = {
          FAST_MOVING: 'Fast Moving',
          MEDIUM_MOVING: 'Medium Moving',
          SLOW_MOVING: 'Slow Moving',
          DEAD_STOCK: 'Dead Stock',
        };
        return (
          <Badge variant={variants[row.velocity] || 'neutral'}>
            {labels[row.velocity] || row.velocity}
          </Badge>
        );
      },
    },
  ];

  // Columns for Aging Report
  const agingColumns = [
    {
      header: 'Batch Lot #',
      key: 'batchNumber',
      render: (row) => <span className="font-mono font-semibold text-slate-900">{row.batchNumber}</span>,
    },
    {
      header: 'SKU / Product',
      key: 'sku',
      render: (row) => (
        <div>
          <span className="font-mono font-medium text-indigo-600 block">{row.sku}</span>
          <span className="text-slate-600 truncate block max-w-xs">{row.productName}</span>
        </div>
      ),
    },
    {
      header: 'Facility / Bin',
      key: 'warehouseCode',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.warehouseCode} &bull; {row.locationCode}
        </span>
      ),
    },
    {
      header: 'Quantity',
      key: 'onHand',
      className: 'text-right font-medium',
      render: (row) => row.onHand?.toLocaleString(),
    },
    {
      header: 'Expiry Date',
      key: 'expiresOn',
      render: (row) => (row.expiresOn ? new Date(row.expiresOn).toLocaleDateString() : 'Non-expiring'),
    },
    {
      header: 'Days Left',
      key: 'daysRemaining',
      className: 'text-right',
      render: (row) => (row.daysRemaining != null ? `${row.daysRemaining}d` : '—'),
    },
    {
      header: 'Lot Valuation',
      key: 'valuationMinor',
      className: 'text-right font-mono',
      render: (row) => formatCurrency(row.valuationMinor),
    },
    {
      header: 'Aging Category',
      key: 'status',
      render: (row) => {
        const variants = {
          EXPIRED: 'danger',
          CRITICAL: 'warning',
          WARNING: 'info',
          HEALTHY: 'success',
          NO_EXPIRY: 'neutral',
        };
        return (
          <Badge variant={variants[row.status] || 'neutral'}>
            {row.status}
          </Badge>
        );
      },
    },
  ];

  // Columns for Discrepancy Report
  const discrepancyColumns = [
    {
      header: 'Audit Date',
      key: 'date',
      render: (row) => (row.date ? new Date(row.date).toLocaleString() : '—'),
    },
    {
      header: 'Movement Event',
      key: 'movementType',
      render: (row) => (
        <Badge variant={row.quantity < 0 ? 'danger' : 'success'}>
          {row.movementType}
        </Badge>
      ),
    },
    {
      header: 'Document Ref',
      key: 'referenceNo',
      render: (row) => <span className="font-mono text-xs text-slate-700">{row.referenceNo || '—'}</span>,
    },
    {
      header: 'Facility / Bin',
      key: 'warehouseCode',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">
          {row.warehouseCode} &bull; {row.locationCode}
        </span>
      ),
    },
    {
      header: 'SKU / Product',
      key: 'sku',
      render: (row) => (
        <div>
          <span className="font-mono font-medium text-indigo-600 block">{row.sku}</span>
          <span className="text-slate-600 truncate block max-w-xs">{row.productName}</span>
        </div>
      ),
    },
    {
      header: 'Quantity Delta',
      key: 'quantity',
      className: 'text-right font-bold',
      render: (row) => (
        <span className={row.quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}>
          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
        </span>
      ),
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (row) => <span className="text-xs text-slate-600">{row.reason || '—'}</span>,
    },
    {
      header: 'Financial Impact',
      key: 'valueMinor',
      className: 'text-right font-semibold',
      render: (row) => {
        const isLoss = row.quantity < 0;
        return (
          <span className={isLoss ? 'text-rose-600' : 'text-emerald-600'}>
            {isLoss ? '-' : '+'}
            {formatCurrency(Math.abs(row.valueMinor || 0))}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Analytics &amp; Intelligence Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-dimensional financial valuation, velocity classifications, batch aging, and audit reconciliation
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={handleRefresh}
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
            onClick={handleExportCsv}
            disabled={isExporting || isLoading}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </Button>
        </div>
      </div>

      {/* Report Tab Navigation Bar */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {REPORT_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap py-3.5 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Global Filter Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <Select
            id="filter-warehouse"
            label="Warehouse"
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            options={[
              { value: '', label: 'All Warehouses' },
              ...warehouses.map((w) => ({
                value: w.id || w._id,
                label: `${w.code} - ${w.name}`,
              })),
            ]}
          />
        </div>

        {(activeTab === 'valuation' || activeTab === 'aging') && (
          <div>
            <Select
              id="filter-category"
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({
                  value: c.id || c._id,
                  label: c.name,
                })),
              ]}
            />
          </div>
        )}

        {activeTab === 'turnover' && (
          <div>
            <Select
              id="filter-days"
              label="Evaluation Window"
              value={daysFilter}
              onChange={(e) => setDaysFilter(e.target.value)}
              options={[
                { value: '7', label: 'Last 7 Days' },
                { value: '30', label: 'Last 30 Days' },
                { value: '60', label: 'Last 60 Days' },
                { value: '90', label: 'Last 90 Days' },
                { value: '180', label: 'Last 180 Days' },
              ]}
            />
          </div>
        )}

        <div className={activeTab === 'discrepancy' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <label
            htmlFor="search-reports"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            Filter By SKU or Keyword
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id="search-reports"
              type="text"
              placeholder="Search product SKU, title, or reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
            />
          </div>
        </div>
      </div>

      {/* Tab Specific Content */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {/* Valuation Summary Banner */}
          {valuationData?.summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Asset Cost Value
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCurrency(valuationData.summary.totalCostMinor)}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Across {valuationData.summary.totalQuantity?.toLocaleString()} total units
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Retail Value
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCurrency(valuationData.summary.totalSaleMinor)}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Est. revenue at current sale prices
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Potential Gross Profit
                </span>
                <div className="mt-2 text-2xl font-bold text-emerald-600">
                  {formatCurrency(valuationData.summary.totalMarginMinor)}
                </div>
                <span className="text-xs text-emerald-700 mt-1 block font-medium">
                  Retail minus cost basis
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Catalog Coverage
                </span>
                <div className="mt-2 text-2xl font-bold text-indigo-600">
                  {valuationData.summary.totalSkus?.toLocaleString()} SKUs
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Active stocked products</span>
              </div>
            </div>
          )}

          {/* Itemized Valuation Table */}
          <DataTable
            columns={valuationColumns}
            data={filterBySearch(valuationData?.items || [], ['sku', 'name', 'category'])}
            isLoading={isLoading}
            emptyMessage="No inventory balance records match selected valuation filters."
          />
        </div>
      )}

      {activeTab === 'turnover' && (
        <div className="space-y-6">
          {/* Turnover Velocity Summary Banner */}
          {turnoverData?.summary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Total Evaluated
                </span>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {turnoverData.summary.totalProductsEvaluated}
                </div>
                <span className="text-[11px] text-slate-400">SKUs in period</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                  Fast Moving
                </span>
                <div className="mt-1 text-2xl font-bold text-emerald-700">
                  {turnoverData.summary.fastMovingCount}
                </div>
                <span className="text-[11px] text-emerald-600">High velocity (&gt;1.5x)</span>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
                  Medium Velocity
                </span>
                <div className="mt-1 text-2xl font-bold text-sky-700">
                  {turnoverData.summary.mediumMovingCount}
                </div>
                <span className="text-[11px] text-sky-600">Steady demand (0.5x - 1.5x)</span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">
                  Slow Moving
                </span>
                <div className="mt-1 text-2xl font-bold text-amber-700">
                  {turnoverData.summary.slowMovingCount}
                </div>
                <span className="text-[11px] text-amber-600">Low turnover (&lt;0.5x)</span>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">
                  Dead Stock
                </span>
                <div className="mt-1 text-2xl font-bold text-rose-700">
                  {turnoverData.summary.deadStockCount}
                </div>
                <span className="text-[11px] text-rose-600">0 outbound movements</span>
              </div>
            </div>
          )}

          {/* Turnover Velocity Table */}
          <DataTable
            columns={turnoverColumns}
            data={filterBySearch(turnoverData?.items || [], ['sku', 'name', 'category'])}
            isLoading={isLoading}
            emptyMessage="No stock velocity records match selected filters."
          />
        </div>
      )}

      {activeTab === 'aging' && (
        <div className="space-y-6">
          {/* Aging Expiry Buckets Summary Banner */}
          {agingData?.summary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 block">
                  Expired Batches
                </span>
                <div className="mt-1 text-2xl font-bold text-rose-700">
                  {agingData.summary.expiredCount}
                </div>
                <span className="text-[11px] text-rose-600">Requires write-off quarantine</span>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block">
                  Critical (&lt; 30 Days)
                </span>
                <div className="mt-1 text-2xl font-bold text-amber-700">
                  {agingData.summary.criticalCount}
                </div>
                <span className="text-[11px] text-amber-600">Urgent outbound priority</span>
              </div>

              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
                  Warning (30 - 90 Days)
                </span>
                <div className="mt-1 text-2xl font-bold text-sky-700">
                  {agingData.summary.warningCount}
                </div>
                <span className="text-[11px] text-sky-600">Monitor dispatch rate</span>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                  Healthy (&gt; 90 Days)
                </span>
                <div className="mt-1 text-2xl font-bold text-emerald-700">
                  {agingData.summary.healthyCount}
                </div>
                <span className="text-[11px] text-emerald-600">Optimal shelf life</span>
              </div>
            </div>
          )}

          {/* Aging Table */}
          <DataTable
            columns={agingColumns}
            data={filterBySearch(agingData?.items || [], ['batchNumber', 'sku', 'productName'])}
            isLoading={isLoading}
            emptyMessage="No batch inventory records match selected aging filters."
          />
        </div>
      )}

      {activeTab === 'discrepancy' && (
        <div className="space-y-6">
          {/* Discrepancies Summary Banner */}
          {discrepancyData?.summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Audit Events
                </span>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {discrepancyData.summary.totalEntries}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  +{discrepancyData.summary.totalGainQty} Gain &bull; -{discrepancyData.summary.totalLossQty} Loss &bull; -{discrepancyData.summary.totalWriteOffQty} Write-off
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Net Variance Units
                </span>
                <div
                  className={`mt-2 text-2xl font-bold ${
                    discrepancyData.summary.netQuantity < 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {discrepancyData.summary.netQuantity > 0
                    ? `+${discrepancyData.summary.netQuantity}`
                    : discrepancyData.summary.netQuantity}{' '}
                  units
                </div>
                <span className="text-xs text-slate-500 mt-1 block">
                  Net physical deviation
                </span>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Total Shrinkage Losses
                </span>
                <div className="mt-2 text-2xl font-bold text-rose-700">
                  -{formatCurrency(discrepancyData.summary.totalLossValueMinor)}
                </div>
                <span className="text-xs text-rose-600 mt-1 block font-medium">
                  Stock deficits and write-offs
                </span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Net Financial Impact
                </span>
                <div
                  className={`mt-2 text-2xl font-bold ${
                    discrepancyData.summary.netValueMinor < 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {discrepancyData.summary.netValueMinor < 0 ? '-' : '+'}
                  {formatCurrency(
                    Math.abs(discrepancyData.summary.netValueMinor || 0),
                  )}
                </div>
                <span className="text-xs text-slate-500 mt-1 block">Net impact to P&amp;L balance</span>
              </div>
            </div>
          )}

          {/* Discrepancies Table */}
          <DataTable
            columns={discrepancyColumns}
            data={filterBySearch(discrepancyData?.items || [], [
              'sku',
              'productName',
              'reference',
              'reasonCode',
            ])}
            isLoading={isLoading}
            emptyMessage="No audit discrepancy or shrinkage events found for selected parameters."
          />
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
