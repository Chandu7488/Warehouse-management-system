/**
 * StockPilot WMS - Cycle Counts & Physical Inventory Page.
 *
 * Coordinates inventory audits, snapshot freezing, blind counting sessions,
 * variance valuations, and stock ledger reconciliation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Plus,
  Search,
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchCycleCounts, startCycleCount } from '../countsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import CreateCountPlanModal from '../components/CreateCountPlanModal.jsx';

const STATUS_BADGE_VARIANTS = {
  DRAFT: 'zinc',
  IN_PROGRESS: 'warning',
  COUNTED: 'indigo',
  RECONCILED: 'success',
  CANCELLED: 'danger',
};

const TYPE_LABELS = {
  CYCLE_COUNT: 'Cycle Count',
  FULL_PHYSICAL: 'Full Physical',
  SPOT_CHECK: 'Spot Check',
};

/**
 * Cycle Counts main page component.
 *
 * @returns {JSX.Element}
 */
export const CycleCountsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();

  const canWrite =
    userCan(PERMISSIONS.COUNTS_WRITE) || userCan(PERMISSIONS.INVENTORY_WRITE);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];

  const { data: countsData, isLoading } = useQuery({
    queryKey: ['cycle-counts', { page, search, warehouseFilter, statusFilter, typeFilter }],
    queryFn: () =>
      fetchCycleCounts({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
  });

  const countItems = countsData?.items || [];
  const meta = countsData?.meta || { page: 1, total: 0, totalPages: 1 };

  const startMutation = useMutation({
    mutationFn: (id) => startCycleCount(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      const id = data.id || data._id;
      if (id) {
        navigate(`/counts/${id}`);
      }
    },
  });

  const activeCountSessions = countItems.filter(
    (c) => c.status === 'IN_PROGRESS' || c.status === 'COUNTED',
  ).length;

  const discrepanciesCount = countItems.reduce(
    (acc, c) => acc + (c.varianceItems || 0),
    0,
  );

  const reconciledCount = countItems.filter((c) => c.status === 'RECONCILED').length;

  const columns = [
    {
      header: 'Count Session',
      accessorKey: 'countNumber',
      cell: ({ row }) => {
        const item = row.original;
        const id = item.id || item._id;
        return (
          <div>
            <button
              onClick={() => navigate(`/counts/${id}`)}
              className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 text-left"
            >
              {item.countNumber}
            </button>
            <div className="text-xs text-slate-500 mt-0.5">
              {TYPE_LABELS[item.type] || item.type}
              {item.blindCount && (
                <span className="ml-1.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                  Blind
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Warehouse',
      accessorKey: 'warehouse',
      cell: ({ row }) => {
        const wh = row.original.warehouse;
        return (
          <div className="text-sm">
            <span className="font-medium text-slate-900">
              {wh?.code || '—'}
            </span>
            <div className="text-xs text-slate-500">{wh?.name}</div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = STATUS_BADGE_VARIANTS[status] || 'zinc';
        return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
      },
    },
    {
      header: 'Scope & Lines',
      accessorKey: 'totalItems',
      cell: ({ row }) => {
        const item = row.original;
        const total = item.totalItems || 0;
        const matched = item.matchedItems || 0;
        const variances = item.varianceItems || 0;

        if (item.status === 'DRAFT') {
          return (
            <span className="text-xs text-slate-500">
              {item.scope?.locations?.length
                ? `${item.scope.locations.length} locs`
                : 'Facility-wide'}{' '}
              (Pending Start)
            </span>
          );
        }

        return (
          <div className="text-xs space-y-0.5">
            <div className="font-medium text-slate-800">
              {total} SKU-Bin Lines
            </div>
            {item.status !== 'DRAFT' && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-600">
                  {matched} matched
                </span>
                {variances > 0 ? (
                  <span className="text-rose-600 font-medium">
                    {variances} variance
                  </span>
                ) : (
                  <span className="text-slate-400">0 variance</span>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Net Variance Value',
      accessorKey: 'netVarianceValueMinor',
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === 'DRAFT') return <span className="text-xs text-slate-400">—</span>;

        const valMinor = item.netVarianceValueMinor || 0;
        const dollars = (valMinor / 100).toFixed(2);
        const isPositive = valMinor > 0;
        const isNegative = valMinor < 0;

        return (
          <span
            className={`text-xs font-semibold ${
              isNegative
                ? 'text-rose-600'
                : isPositive
                ? 'text-emerald-600'
                : 'text-slate-600'
            }`}
          >
            {isPositive ? `+$${dollars}` : isNegative ? `-$${Math.abs(dollars)}` : '$0.00'}
          </span>
        );
      },
    },
    {
      header: 'Created / Assigned',
      accessorKey: 'createdAt',
      cell: ({ row }) => {
        const item = row.original;
        const dateStr = item.createdAt
          ? new Date(item.createdAt).toLocaleDateString()
          : '—';
        return (
          <div className="text-xs text-slate-600">
            <div>{dateStr}</div>
            <div className="text-slate-500">{item.assignedTo?.name || item.createdBy?.name || ''}</div>
          </div>
        );
      },
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;
        const id = item.id || item._id;

        return (
          <div className="flex items-center gap-2">
            {item.status === 'DRAFT' && canWrite && (
              <Button
                size="xs"
                variant="outline"
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                icon={Play}
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate(id)}
              >
                Start Count
              </Button>
            )}

            {item.status === 'IN_PROGRESS' && (
              <Button
                size="xs"
                variant="primary"
                icon={ClipboardCheck}
                onClick={() => navigate(`/counts/${id}`)}
              >
                Enter Counts
              </Button>
            )}

            {item.status === 'COUNTED' && (
              <Button
                size="xs"
                variant="outline"
                className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                icon={CheckCircle2}
                onClick={() => navigate(`/counts/${id}`)}
              >
                Review & Reconcile
              </Button>
            )}

            <Button
              size="xs"
              variant="ghost"
              icon={Eye}
              onClick={() => navigate(`/counts/${id}`)}
            >
              View
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-indigo-600" />
            Cycle Counting &amp; Physical Inventory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conduct blind cycle counts, audit stock accuracy, freeze inventory snapshots, and post discrepancy ledger adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={SlidersHorizontal}
            onClick={() => navigate('/adjustments')}
          >
            Direct Adjustments
          </Button>
          {canWrite && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              Plan Cycle Count
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Count Sessions
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {activeCountSessions}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">In progress or awaiting review</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Discrepancies Identified
            </div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {discrepanciesCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">SKU-bin variance lines</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Reconciled Audits
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {reconciledCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Stock ledger balanced</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search count # or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            icon={Search}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value);
              setPage(1);
            }}
            className="w-44"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => {
              const id = w.id || w._id;
              return (
                <option key={id} value={id}>
                  {w.code}
                </option>
              );
            })}
          </Select>

          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="">All Types</option>
            <option value="CYCLE_COUNT">Cycle Count</option>
            <option value="FULL_PHYSICAL">Full Physical</option>
            <option value="SPOT_CHECK">Spot Check</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-36"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COUNTED">Counted</option>
            <option value="RECONCILED">Reconciled</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={countItems}
        loading={isLoading}
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          total: meta.total,
          onPageChange: (newPage) => setPage(newPage),
        }}
        emptyMessage="No cycle count sessions found matching your filters."
      />

      {/* Creation Modal */}
      <CreateCountPlanModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};

export default CycleCountsPage;
