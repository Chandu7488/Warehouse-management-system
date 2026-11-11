/**
 * StockPilot WMS - Transfers & Facility Transit Management Page.
 *
 * Coordinates inter-warehouse transfers, intra-warehouse relocations,
 * transit lifecycle dispatch & receiving, and forward replenishment links.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Truck,
  ArrowDownToLine,
  ArrowRightLeft,
  Sliders,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { fetchTransferOrders } from '../transfersApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import CreateTransferModal from '../components/CreateTransferModal.jsx';
import DirectBinTransferModal from '../components/DirectBinTransferModal.jsx';
import TransferDetailModal from '../components/TransferDetailModal.jsx';
import DispatchTransferModal from '../components/DispatchTransferModal.jsx';
import ReceiveTransferModal from '../components/ReceiveTransferModal.jsx';

const STATUS_VARIANTS = {
  PENDING_DISPATCH: 'info',
  IN_TRANSIT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Transfers Page component.
 *
 * @returns {JSX.Element}
 */
export const TransfersPage = () => {
  const navigate = useNavigate();
  const { can: userCan } = useAuth();
  const canWrite =
    userCan(PERMISSIONS.TRANSFERS_WRITE) || userCan(PERMISSIONS.INVENTORY_WRITE);

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [originWarehouse, setOriginWarehouse] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [transferType, setTransferType] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDirectOpen, setIsDirectOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [receiveOrder, setReceiveOrder] = useState(null);

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];

  // Fetch transfer orders
  const { data, isLoading } = useQuery({
    queryKey: [
      'transfer-orders',
      page,
      pageSize,
      search,
      originWarehouse,
      destinationWarehouse,
      statusFilter,
      transferType,
    ],
    queryFn: () =>
      fetchTransferOrders({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        originWarehouse: originWarehouse || undefined,
        destinationWarehouse: destinationWarehouse || undefined,
        status: statusFilter || undefined,
        transferType: transferType || undefined,
      }),
  });

  const orders = data?.items || [];
  const meta = data?.meta || { total: 0, totalPages: 1, page: 1, limit: 20 };

  // Calculate statistics
  const pendingCount = orders.filter((o) => o.status === 'PENDING_DISPATCH').length;
  const inTransitCount = orders.filter((o) => o.status === 'IN_TRANSIT').length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const columns = [
    {
      header: 'Transfer #',
      key: 'transferNumber',
      render: (row) => (
        <div>
          <span className="font-bold font-mono text-indigo-700 block">
            {row.transferNumber}
          </span>
          <span className="text-[11px] text-slate-500">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Type',
      key: 'transferType',
      render: (row) => (
        <Badge variant="outline" className="text-[11px]">
          {row.transferType === 'INTER_WAREHOUSE' ? 'Inter-Facility' : 'Intra-Warehouse'}
        </Badge>
      ),
    },
    {
      header: 'Facility Route',
      key: 'route',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-slate-800">
            {row.originWarehouse?.code || 'Origin'}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-800">
            {row.destinationWarehouse?.code || 'Dest'}
          </span>
        </div>
      ),
    },
    {
      header: 'Items',
      key: 'items',
      render: (row) => (
        <span className="text-xs font-semibold text-slate-700">
          {row.items?.length || 0} line{row.items?.length === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      header: 'Carrier & Tracking',
      key: 'carrier',
      render: (row) => (
        <div className="text-xs">
          {row.carrier ? (
            <>
              <span className="font-medium text-slate-800 block">{row.carrier}</span>
              <span className="text-[11px] font-mono text-slate-500">
                {row.trackingNumber || 'No tracking'}
              </span>
            </>
          ) : (
            <span className="text-slate-400 italic">None assigned</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'secondary'}>
          {row.status?.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        return (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrderId(row._id)}
              className="text-xs px-2 py-1"
              title="View Transfer Details"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              View
            </Button>

            {canWrite && row.status === 'PENDING_DISPATCH' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setDispatchOrder(row)}
                className="text-xs px-2 py-1"
                title="Dispatch Transfer"
              >
                <Truck className="w-3.5 h-3.5 mr-1" />
                Dispatch
              </Button>
            )}

            {canWrite && row.status === 'IN_TRANSIT' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setReceiveOrder(row)}
                className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
                title="Receive Intake"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 mr-1" />
                Receive
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Triggers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Transfers & Relocation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage intra-warehouse bin movements, inter-facility transit dispatches, and receiving.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/transfers/replenishment')}
            className="text-xs sm:text-sm"
          >
            <Sliders className="w-4 h-4 mr-1.5 text-indigo-600" />
            Min/Max Replenishment
          </Button>

          {canWrite && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDirectOpen(true)}
                className="text-xs sm:text-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <ArrowRightLeft className="w-4 h-4 mr-1.5" />
                Direct Bin Relocation
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Transfer Order
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Transfers
            </span>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 mt-2 block">
            {meta.total}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Dispatch
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          </div>
          <span className="text-2xl font-extrabold text-sky-600 mt-2 block">
            {pendingCount}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              In Transit
            </span>
            <Truck className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-extrabold text-amber-600 mt-2 block">
            {inTransitCount}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-2xl font-extrabold text-emerald-600 mt-2 block">
            {completedCount}
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search transfer #, carrier..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div>
            <Select
              value={originWarehouse}
              onChange={(e) => {
                setOriginWarehouse(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Origin Warehouses' },
                ...warehouses.map((w) => ({ value: w.id || w._id, label: `From: ${w.code}` })),
              ]}
            />
          </div>

          <div>
            <Select
              value={destinationWarehouse}
              onChange={(e) => {
                setDestinationWarehouse(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Destination Warehouses' },
                ...warehouses.map((w) => ({ value: w.id || w._id, label: `To: ${w.code}` })),
              ]}
            />
          </div>

          <div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'PENDING_DISPATCH', label: 'Pending Dispatch' },
                { value: 'IN_TRANSIT', label: 'In Transit' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
          </div>

          <div>
            <Select
              value={transferType}
              onChange={(e) => {
                setTransferType(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Transfer Types' },
                { value: 'INTER_WAREHOUSE', label: 'Inter-Warehouse' },
                { value: 'INTRA_WAREHOUSE', label: 'Intra-Warehouse' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Transfer Orders Data Table */}
      <DataTable
        data={orders}
        columns={columns}
        isLoading={isLoading}
        pagination={{
          page,
          totalPages: meta.totalPages,
          total: meta.total,
          onPageChange: setPage,
        }}
        emptyMessage="No transfer orders found matching current criteria."
      />

      {/* Modals */}
      <CreateTransferModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <DirectBinTransferModal
        isOpen={isDirectOpen}
        onClose={() => setIsDirectOpen(false)}
      />

      <TransferDetailModal
        isOpen={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
        onOpenDispatch={(order) => setDispatchOrder(order)}
        onOpenReceive={(order) => setReceiveOrder(order)}
      />

      <DispatchTransferModal
        isOpen={Boolean(dispatchOrder)}
        onClose={() => setDispatchOrder(null)}
        order={dispatchOrder}
      />

      <ReceiveTransferModal
        isOpen={Boolean(receiveOrder)}
        onClose={() => setReceiveOrder(null)}
        order={receiveOrder}
      />
    </div>
  );
};

export default TransfersPage;
