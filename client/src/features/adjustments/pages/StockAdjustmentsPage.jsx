/**
 * StockPilot WMS - Stock Adjustments & Write-Offs Management Page.
 *
 * Coordinates ad-hoc inventory adjustments, scrap deductions, surplus intake,
 * and supervisory approval workflows with transactional stock posting.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  SlidersHorizontal,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ClipboardCheck,
} from 'lucide-react';
import {
  fetchAdjustments,
  approveAdjustment,
  rejectAdjustment,
} from '../adjustmentsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import CreateAdjustmentModal from '../components/CreateAdjustmentModal.jsx';

const STATUS_BADGE_VARIANTS = {
  DRAFT: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const TYPE_LABELS = {
  WRITE_OFF: 'Write-Off',
  DAMAGED_SCRAP: 'Damaged Scrap',
  FOUND_STOCK: 'Found Stock',
  MANUAL_ADJUSTMENT: 'Manual Adj',
  CYCLE_COUNT_VARIANCE: 'Cycle Count',
};

/**
 * Stock Adjustments main page component.
 *
 * @returns {JSX.Element}
 */
export const StockAdjustmentsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can: userCan } = useAuth();

  const canApprove =
    userCan(PERMISSIONS.ADJUSTMENTS_APPROVE) || user?.role === 'ADMIN';
  const canWrite =
    userCan(PERMISSIONS.ADJUSTMENTS_WRITE) || userCan(PERMISSIONS.INVENTORY_WRITE);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewAdjustment, setViewAdjustment] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];

  const { data: adjustmentsData, isLoading } = useQuery({
    queryKey: ['stock-adjustments', { page, search, warehouseFilter, statusFilter, typeFilter }],
    queryFn: () =>
      fetchAdjustments({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      }),
  });

  const adjustmentItems = adjustmentsData?.items || [];
  const meta = adjustmentsData?.meta || { page: 1, total: 0, totalPages: 1 };

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }) => approveAdjustment(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => rejectAdjustment(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
    },
  });

  const pendingCount = adjustmentItems.filter((a) => a.status === 'DRAFT').length;
  const approvedCount = adjustmentItems.filter((a) => a.status === 'APPROVED').length;
  const netWriteOffQty = adjustmentItems.reduce(
    (acc, a) => acc + (a.status === 'APPROVED' ? a.netQuantity || 0 : 0),
    0,
  );

  const columns = [
    {
      header: 'Adjustment #',
      accessorKey: 'adjustmentNumber',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <button
              onClick={() => setViewAdjustment(item)}
              className="font-mono text-sm font-semibold text-indigo-600 hover:text-indigo-800 text-left"
            >
              {item.adjustmentNumber}
            </button>
            <div className="text-xs text-slate-500 mt-0.5">
              {TYPE_LABELS[item.type] || item.type}
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
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    {
      header: 'Reason & Justification',
      accessorKey: 'reason',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-xs max-w-xs">
            <div className="font-medium text-slate-800 truncate">
              {item.reason}
            </div>
            {item.notes && <div className="text-slate-500 truncate">{item.notes}</div>}
          </div>
        );
      },
    },
    {
      header: 'Net Quantity',
      accessorKey: 'netQuantity',
      cell: ({ row }) => {
        const qty = row.original.netQuantity || 0;
        const isNegative = qty < 0;
        const isPositive = qty > 0;

        return (
          <span
            className={`font-mono text-xs font-semibold ${
              isNegative
                ? 'text-rose-600'
                : isPositive
                ? 'text-emerald-600'
                : 'text-slate-600'
            }`}
          >
            {isPositive ? `+${qty}` : qty} units
          </span>
        );
      },
    },
    {
      header: 'Net Valuation',
      accessorKey: 'netValueMinor',
      cell: ({ row }) => {
        const valMinor = row.original.netValueMinor || 0;
        const dollars = (valMinor / 100).toFixed(2);
        const isNegative = valMinor < 0;
        const isPositive = valMinor > 0;

        return (
          <span
            className={`font-mono text-xs font-medium ${
              isNegative
                ? 'text-rose-600'
                : isPositive
                ? 'text-emerald-600'
                : 'text-slate-500'
            }`}
          >
            {isPositive ? `+$${dollars}` : isNegative ? `-$${Math.abs(dollars)}` : '$0.00'}
          </span>
        );
      },
    },
    {
      header: 'Created / Approved',
      accessorKey: 'createdAt',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-xs text-slate-600">
            <div>{new Date(item.createdAt).toLocaleDateString()}</div>
            <div className="text-slate-500">{item.createdBy?.name || ''}</div>
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
            {item.status === 'DRAFT' && canApprove && (
              <>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  icon={CheckCircle2}
                  loading={approveMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Approve adjustment ${item.adjustmentNumber} and post to stock ledger?`)) {
                      approveMutation.mutate({ id, notes: 'Approved by manager' });
                    }
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  className="text-rose-700 border-rose-300 hover:bg-rose-50"
                  icon={XCircle}
                  loading={rejectMutation.isPending}
                  onClick={() => {
                    const reason = window.prompt('Enter reason for rejecting adjustment proposal:');
                    if (reason) {
                      rejectMutation.mutate({ id, reason });
                    }
                  }}
                >
                  Reject
                </Button>
              </>
            )}

            <Button
              size="xs"
              variant="ghost"
              icon={Eye}
              onClick={() => setViewAdjustment(item)}
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
            <SlidersHorizontal className="w-7 h-7 text-indigo-600" />
            Stock Adjustments &amp; Write-Offs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Propose and approve direct inventory write-offs, scrap reductions, found surplus, and discrepancy corrections.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            icon={ClipboardCheck}
            onClick={() => navigate('/counts')}
          >
            Cycle Counts
          </Button>
          {canWrite && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              New Adjustment / Write-Off
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Approval
            </div>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">
              {pendingCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Awaiting supervisor sign-off</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved Adjustments
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">
              {approvedCount}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Executed into stock ledger</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Quantity Adjusted
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {netWriteOffQty > 0 ? `+${netWriteOffQty}` : netWriteOffQty} units
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Historical ledger impact</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search adjustment # or reason..."
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
            className="w-44"
          >
            <option value="">All Classifications</option>
            <option value="WRITE_OFF">Stock Write-Off</option>
            <option value="DAMAGED_SCRAP">Damaged Scrap</option>
            <option value="FOUND_STOCK">Found Stock</option>
            <option value="MANUAL_ADJUSTMENT">Manual Adjustment</option>
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
            <option value="DRAFT">Pending (Draft)</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={adjustmentItems}
        loading={isLoading}
        pagination={{
          page: meta.page,
          totalPages: meta.totalPages,
          total: meta.total,
          onPageChange: (newPage) => setPage(newPage),
        }}
        emptyMessage="No stock adjustments found matching your filters."
      />

      {/* Detail Modal */}
      {viewAdjustment && (
        <Modal
          isOpen={Boolean(viewAdjustment)}
          onClose={() => setViewAdjustment(null)}
          title={`Adjustment ${viewAdjustment.adjustmentNumber}`}
          description={`Classification: ${TYPE_LABELS[viewAdjustment.type] || viewAdjustment.type} · Warehouse: ${viewAdjustment.warehouse?.name || viewAdjustment.warehouse?.code}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Justification: </span>
                <span className="text-slate-600">{viewAdjustment.reason}</span>
              </div>
              {viewAdjustment.notes && (
                <div>
                  <span className="font-semibold text-slate-700">Notes: </span>
                  <span className="text-slate-600">{viewAdjustment.notes}</span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5">Bin</th>
                    <th className="p-2.5 text-right">Adjustment Qty</th>
                    <th className="p-2.5">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {viewAdjustment.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-medium text-slate-900">{it.product?.sku || it.product}</td>
                      <td className="p-2.5 font-mono text-slate-700">{it.location?.code || it.location}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-900">
                        {it.quantity > 0 ? `+${it.quantity}` : it.quantity}
                      </td>
                      <td className="p-2.5 text-slate-500">{it.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="outline" onClick={() => setViewAdjustment(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Creation Modal */}
      <CreateAdjustmentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};

export default StockAdjustmentsPage;
