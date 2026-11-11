/**
 * StockPilot WMS - Sales Orders Management Page.
 *
 * Implements customer order capture, status tracking, stock reservation,
 * wave pick coordination, and dispatch handoffs.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Eye,
  ArrowRight,
  Truck,
} from 'lucide-react';
import { fetchSalesOrders } from '../salesOrdersApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchCustomers } from '@/features/customers/customersApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import { formatMoney } from '@/lib/money.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import SalesOrderModal from '../components/SalesOrderModal.jsx';
import SalesOrderDetailModal from '../components/SalesOrderDetailModal.jsx';
import CreatePickListModal from '../components/CreatePickListModal.jsx';
import DispatchModal from '../components/DispatchModal.jsx';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  CONFIRMED: 'info',
  ALLOCATED: 'warning',
  PICKING: 'warning',
  PACKED: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/**
 * Sales Orders Page component.
 *
 * @returns {JSX.Element}
 */
export const SalesOrdersPage = () => {
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.ORDERS_WRITE);
  const canPick = userCan(PERMISSIONS.PICKING_WRITE);
  const canShip = userCan(PERMISSIONS.SHIPPING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [pickWaveOrder, setPickWaveOrder] = useState(null);
  const [isPickWaveOpen, setIsPickWaveOpen] = useState(false);
  const [shipOrderTarget, setShipOrderTarget] = useState(null);
  const [isShipOpen, setIsShipOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => fetchCustomers({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'sales-orders',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        customer: customerFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchSalesOrders({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        customer: customerFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const orders = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];
  const customers = customersData?.items || [];

  const handleOpenDetail = (ord) => {
    setSelectedOrder(ord);
    setIsDetailOpen(true);
  };

  const handleStartPickWave = (ord) => {
    setPickWaveOrder(ord);
    setIsPickWaveOpen(true);
  };

  const handleStartShip = (ord) => {
    setShipOrderTarget(ord);
    setIsShipOpen(true);
  };

  const columns = [
    {
      key: 'soNumber',
      header: 'Order #',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenDetail(row)}
          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.soNumber}
        </button>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">
            {row.customer?.name || 'Customer'}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {row.customer?.code}
          </span>
        </div>
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
      key: 'progress',
      header: 'Fulfillment',
      render: (row) => {
        const items = row.items || [];
        const total = items.reduce((s, it) => s + (it.orderedQty || 0), 0);
        const alloc = items.reduce((s, it) => s + (it.allocatedQty || 0), 0);
        const shipped = items.reduce((s, it) => s + (it.shippedQty || 0), 0);

        return (
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{items.length} lines</span>
            <div className="text-[11px] text-slate-500">
              Alloc: {alloc}/{total} &middot; Ship: {shipped}/{total}
            </div>
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Total Amount',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-900 text-xs">
          {formatMoney(row.totalMinor ?? row.totalAmountMinor ?? 0, row.currency || 'USD')}
        </span>
      ),
    },
    {
      key: 'orderDate',
      header: 'Created Date',
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
            onClick={() => handleOpenDetail(row)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {(row.status === 'CONFIRMED' || row.status === 'ALLOCATED') && canPick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStartPickWave(row)}
              title="Create Pick Wave"
              className="text-indigo-600 hover:text-indigo-800"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {(row.status === 'ALLOCATED' || row.status === 'PACKED' || row.status === 'PICKING') && canShip && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleStartShip(row)}
              title="Ship Order"
              className="text-emerald-600 hover:text-emerald-800"
            >
              <Truck className="h-4 w-4" />
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
            Sales Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer order capture, FEFO/FIFO stock allocation, wave picking, and shipment dispatch.
          </p>
        </div>

        {canWrite && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Sales Order
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search order number or note..."
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
          value={customerFilter}
          onChange={(e) => {
            setCustomerFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Customers' },
            ...customers.map((c) => ({
              value: c.id || c._id,
              label: `${c.name} (${c.code})`,
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
            { value: 'DRAFT', label: 'Draft' },
            { value: 'CONFIRMED', label: 'Confirmed' },
            { value: 'ALLOCATED', label: 'Allocated' },
            { value: 'PICKING', label: 'Picking' },
            { value: 'PACKED', label: 'Packed' },
            { value: 'SHIPPED', label: 'Shipped' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          pagination={{
            page: meta.page,
            totalPages: meta.totalPages,
            totalItems: meta.total,
            pageSize: meta.limit,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyMessage="No sales orders matching your filter criteria."
        />
      </div>

      {/* Creation Modal */}
      <SalesOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Detail & Action Modal */}
      <SalesOrderDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        order={selectedOrder}
        onCreatePickWave={handleStartPickWave}
        onCreateShipment={handleStartShip}
        canWrite={canWrite}
        canPick={canPick}
        canShip={canShip}
      />

      {/* Wave Pick Creation Modal */}
      <CreatePickListModal
        isOpen={isPickWaveOpen}
        onClose={() => setIsPickWaveOpen(false)}
        initialOrder={pickWaveOrder}
      />

      {/* Dispatch Modal */}
      <DispatchModal
        isOpen={isShipOpen}
        onClose={() => setIsShipOpen(false)}
        salesOrder={shipOrderTarget}
      />
    </div>
  );
};

export default SalesOrdersPage;
