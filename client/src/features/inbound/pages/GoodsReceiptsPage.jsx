/**
 * StockPilot WMS - Goods Receipts (GRN) Management Page.
 *
 * Provides physical dock receiving intake histories, QA disposition inspection,
 * and direct progression to directed putaway tasks.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Eye, ArrowDownToLine } from 'lucide-react';
import { fetchGoodsReceipts } from '../inboundApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import GoodsReceiptModal from '../components/GoodsReceiptModal.jsx';
import GoodsReceiptDetailModal from '../components/GoodsReceiptDetailModal.jsx';

const STATUS_VARIANTS = {
  RECEIVED: 'info',
  INSPECTED: 'secondary',
  PUTAWAY_IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

/**
 * Goods Receipts Page component.
 *
 * @returns {JSX.Element}
 */
export const GoodsReceiptsPage = () => {
  const { can: userCan } = useAuth();
  const canReceive = userCan(PERMISSIONS.RECEIVING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'goods-receipts',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchGoodsReceipts({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const goodsReceipts = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];

  const handleOpenDetail = (grn) => {
    setSelectedGrn(grn);
    setIsDetailOpen(true);
  };

  const columns = [
    {
      key: 'grnNumber',
      header: 'GRN Number',
      render: (row) => (
        <button
          onClick={() => handleOpenDetail(row)}
          className="font-semibold text-emerald-600 hover:text-emerald-800 text-left font-mono"
        >
          {row.grnNumber}
        </button>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received Date',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {new Date(row.createdAt).toLocaleDateString()} &middot;{' '}
          <span className="text-slate-400">
            {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.supplier?.name || 'N/A'}</div>
          <div className="text-xs text-slate-400 font-mono">{row.supplier?.code}</div>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse / Dock',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {row.warehouse?.code || 'N/A'}
          </span>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {row.receivingLocation?.code || 'RECEIVING'}
          </div>
        </div>
      ),
    },
    {
      key: 'purchaseOrder',
      header: 'Linked PO',
      render: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {row.purchaseOrder?.poNumber || <span className="text-slate-400 italic">Direct Delivery</span>}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Received Items',
      render: (row) => {
        const totalUnits = row.items?.reduce((s, i) => s + (i.receivedQty || 0), 0) || 0;
        return (
          <span className="font-medium text-slate-900 text-xs">
            {row.items?.length || 0} lines ({totalUnits} units)
          </span>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDetail(row)}
            className="p-1 h-7 text-slate-600 hover:text-slate-900"
            title="Inspect Receipt"
          >
            <Eye className="h-4 w-4" />
          </Button>
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
            <ArrowDownToLine className="h-6 w-6 text-emerald-600" />
            Goods Receipts (GRN)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Log physical receiving dock deliveries, lot/serial numbers, and inspection outcomes
          </p>
        </div>

        {canReceive && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Receive Inbound Goods (GRN)
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Input
          placeholder="Search GRN #..."
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
          <option value="RECEIVED">Received</option>
          <option value="INSPECTED">Inspected</option>
          <option value="PUTAWAY_IN_PROGRESS">Putaway In Progress</option>
          <option value="COMPLETED">Completed</option>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={goodsReceipts}
        loading={isLoading}
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyMessage="No goods receipts found matching current filters"
      />

      {/* Receive Modal */}
      <GoodsReceiptModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Detail Modal */}
      <GoodsReceiptDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        grn={selectedGrn}
      />
    </div>
  );
};

export default GoodsReceiptsPage;
