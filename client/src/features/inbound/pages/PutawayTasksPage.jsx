/**
 * StockPilot WMS - Directed Putaway Tasks Page.
 *
 * Coordinates system-directed bin allocations, dock clearance, and storage bin transfers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoveDown, Sparkles, Search, CheckCircle2 } from 'lucide-react';
import { fetchPutawayTasks } from '../inboundApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import ConfirmPutawayModal from '../components/ConfirmPutawayModal.jsx';

const STATUS_VARIANTS = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const PRIORITY_VARIANTS = {
  URGENT: 'danger',
  HIGH: 'warning',
  NORMAL: 'secondary',
  LOW: 'secondary',
};

/**
 * Directed Putaway Tasks Page component.
 *
 * @returns {JSX.Element}
 */
export const PutawayTasksPage = () => {
  const { can: userCan } = useAuth();
  const canPutaway = userCan(PERMISSIONS.RECEIVING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  const [targetTask, setTargetTask] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'putaway-tasks',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchPutawayTasks({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const putawayTasks = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];

  const columns = [
    {
      key: 'taskNumber',
      header: 'Task #',
      render: (row) => (
        <div>
          <span className="font-mono font-semibold text-indigo-700 text-xs">
            {row.taskNumber}
          </span>
          <div className="mt-0.5">
            <Badge variant={PRIORITY_VARIANTS[row.priority] || 'secondary'} className="text-[10px] px-1 py-0">
              {row.priority}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 text-xs">{row.product?.name || 'Item'}</div>
          <div className="text-[11px] text-slate-400 font-mono">{row.product?.sku}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (row) => (
        <span className="font-bold text-slate-800 text-xs">
          {row.quantity} <span className="font-normal text-slate-500">units</span>
        </span>
      ),
    },
    {
      key: 'lotSerial',
      header: 'Lot / Serial',
      render: (row) => {
        if (row.batch?.batchNumber) {
          return (
            <span className="font-mono text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              {row.batch.batchNumber}
            </span>
          );
        }
        if (row.serials && row.serials.length > 0) {
          return (
            <span className="text-xs text-sky-700 font-medium">
              {row.serials.length} serials
            </span>
          );
        }
        return <span className="text-slate-400 text-xs">—</span>;
      },
    },
    {
      key: 'sourceLocation',
      header: 'Source (Dock)',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {row.sourceLocation?.path || row.sourceLocation?.code || 'RECEIVING'}
        </span>
      ),
    },
    {
      key: 'suggestedLocation',
      header: 'Suggested Optimal Bin',
      render: (row) => {
        const dest = row.status === 'COMPLETED' ? row.destinationLocation : row.suggestedLocation;
        return (
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-indigo-700">
            {row.status !== 'COMPLETED' && <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />}
            <span>{dest?.path || dest?.code || 'STORAGE'}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'secondary'}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end">
          {canPutaway && (row.status === 'PENDING' || row.status === 'IN_PROGRESS') ? (
            <Button
              size="sm"
              onClick={() => setTargetTask(row)}
              className="h-7 px-2.5 text-xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700"
            >
              <MoveDown className="h-3.5 w-3.5" />
              Putaway
            </Button>
          ) : row.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MoveDown className="h-6 w-6 text-indigo-600" />
            Directed Putaway Tasks
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            System-directed bin allocation engine based on lot consolidation and warehouse capacity
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Input
          placeholder="Search Task #..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          leftIcon={<Search className="h-4 w-4 text-slate-400" />}
        />

        <Select
          value={warehouseFilter}
          onChange={(e) => {
            setWarehouseFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id || w._id} value={w.id || w._id}>
              {w.name} ({w.code})
            </option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={putawayTasks}
        loading={isLoading}
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyMessage="No putaway tasks found"
      />

      {/* Putaway Execution Modal */}
      <ConfirmPutawayModal
        isOpen={Boolean(targetTask)}
        onClose={() => setTargetTask(null)}
        task={targetTask}
      />
    </div>
  );
};

export default PutawayTasksPage;
