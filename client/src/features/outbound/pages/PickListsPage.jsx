/**
 * StockPilot WMS - Wave / Pick Lists Management Page.
 *
 * Coordinates warehouse picking waves, displays sorted aisle-walk tasks,
 * and tracks operator picking progress.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { fetchPickLists, cancelPickList } from '../pickingApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import CreatePickListModal from '../components/CreatePickListModal.jsx';
import ExecutePickModal from '../components/ExecutePickModal.jsx';

const STATUS_VARIANTS = {
  PENDING: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Wave Pick Lists Page component.
 *
 * @returns {JSX.Element}
 */
export const PickListsPage = () => {
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canPick = userCan(PERMISSIONS.PICKING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPickList, setSelectedPickList] = useState(null);
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'pick-lists',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchPickLists({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelPickList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pick-lists'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const pickLists = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];

  const handleOpenExecution = (pl) => {
    setSelectedPickList(pl);
    setIsExecuteOpen(true);
  };

  const columns = [
    {
      key: 'pickNumber',
      header: 'Pick Wave #',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenExecution(row)}
          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.pickNumber}
        </button>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {row.warehouse?.name || 'N/A'}{' '}
          <span className="font-mono text-slate-400">({row.warehouse?.code})</span>
        </span>
      ),
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
      key: 'orders',
      header: 'Orders',
      render: (row) => (
        <span className="text-xs font-medium text-slate-800">
          {row.salesOrders?.length || 1} Orders
        </span>
      ),
    },
    {
      key: 'stagingLocation',
      header: 'Staging Dock',
      render: (row) => (
        <span className="font-mono text-xs text-indigo-700">
          {row.stagingLocation?.path || row.stagingLocation?.code || 'Dock'}
        </span>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (row) => {
        const items = row.items || [];
        const picked = items.filter((it) => it.status === 'PICKED').length;
        const total = items.length;
        const pct = total > 0 ? Math.round((picked / total) * 100) : 0;

        return (
          <div className="w-28 space-y-1">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>{picked}/{total} items</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'assignedTo',
      header: 'Assigned Operator',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.assignedTo?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenExecution(row)}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            {row.status === 'COMPLETED' ? (
              'View Details'
            ) : row.status === 'IN_PROGRESS' ? (
              'Continue Picking'
            ) : (
              'Execute Wave'
            )}
          </Button>

          {canPick && (row.status === 'PENDING' || row.status === 'IN_PROGRESS') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cancelMutation.mutate(row._id || row.id)}
              disabled={cancelMutation.isPending}
              className="text-red-600 hover:text-red-800"
              title="Cancel Pick List"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Wave Picking
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Batch picking waves sorted by aisle walk sequence for rapid order fulfillment.
          </p>
        </div>

        {canPick && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Pick Wave
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search pick wave number..."
            className="pl-9"
          />
        </div>

        <Select
          value={warehouseFilter}
          onChange={(e) => {
            setWarehouseFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Warehouses' },
            ...warehouses.map((w) => ({
              value: w.id || w._id,
              label: `${w.name} (${w.code})`,
            })),
          ]}
        />

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={pickLists}
          isLoading={isLoading}
          pagination={{
            page: meta.page,
            totalPages: meta.totalPages,
            totalItems: meta.total,
            pageSize: meta.limit,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyMessage="No wave pick lists found."
        />
      </div>

      {/* Wave Creator Modal */}
      <CreatePickListModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(newPl) => {
          setSelectedPickList(newPl);
          setIsExecuteOpen(true);
        }}
      />

      {/* Walk Sequence Execution Modal */}
      <ExecutePickModal
        isOpen={isExecuteOpen}
        onClose={() => setIsExecuteOpen(false)}
        pickList={selectedPickList}
      />
    </div>
  );
};

export default PickListsPage;
