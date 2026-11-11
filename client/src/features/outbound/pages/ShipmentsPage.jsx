/**
 * StockPilot WMS - Outbound Shipments & Dispatch Page.
 *
 * Manages carton packaging, carrier waybill tracking, and immutable
 * ledger stock dispatch handoffs.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import { fetchShipments } from '../shipmentsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import DispatchModal from '../components/DispatchModal.jsx';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  PACKED: 'info',
  DISPATCHED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/**
 * Outbound Shipments Page component.
 *
 * @returns {JSX.Element}
 */
export const ShipmentsPage = () => {
  const { can: userCan } = useAuth();
  const canShip = userCan(PERMISSIONS.SHIPPING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'shipments',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchShipments({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const shipments = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];

  const handleOpenDispatch = (shipment) => {
    setSelectedShipment(shipment);
    setIsDispatchOpen(true);
  };

  const columns = [
    {
      key: 'shipmentNumber',
      header: 'Shipment #',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900">
          {row.shipmentNumber}
        </span>
      ),
    },
    {
      key: 'salesOrder',
      header: 'Sales Order #',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-indigo-600">
          {row.salesOrder?.soNumber || 'Order'}
        </span>
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
      key: 'carrier',
      header: 'Carrier & Tracking',
      render: (row) => (
        <div>
          <span className="text-xs font-semibold text-slate-900 block">
            {row.carrier || 'Pending Carrier'}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {row.trackingNumber ? `Track: ${row.trackingNumber}` : 'No tracking'}
          </span>
        </div>
      ),
    },
    {
      key: 'packages',
      header: 'Packages',
      render: (row) => {
        const pkgs = row.packages || [];
        const totalWeight = pkgs.reduce((sum, p) => sum + (p.weightKg || 0), 0);
        return (
          <div className="text-xs text-slate-700">
            <span>{pkgs.length} Cartons</span>
            {totalWeight > 0 && (
              <span className="block text-[11px] text-slate-500">
                {totalWeight.toFixed(1)} kg total
              </span>
            )}
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
      key: 'dispatchedAt',
      header: 'Dispatched Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.dispatchedAt
            ? new Date(row.dispatchedAt).toLocaleDateString()
            : 'Pending Dispatch'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status !== 'DISPATCHED' && row.status !== 'DELIVERED' && canShip && (
            <Button
              variant="success"
              size="sm"
              onClick={() => handleOpenDispatch(row)}
            >
              <Truck className="h-4 w-4 mr-1" />
              Dispatch
            </Button>
          )}

          {row.status === 'DISPATCHED' && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Shipped
            </span>
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
            Shipments &amp; Dispatch
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Carton packaging, carrier waybills, and outbound stock issues to the inventory ledger.
          </p>
        </div>
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
            placeholder="Search shipment number, carrier, tracking..."
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
            { value: 'DRAFT', label: 'Draft' },
            { value: 'PACKED', label: 'Packed' },
            { value: 'DISPATCHED', label: 'Dispatched' },
            { value: 'DELIVERED', label: 'Delivered' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </div>

      {/* Shipments Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={shipments}
          isLoading={isLoading}
          pagination={{
            page: meta.page,
            totalPages: meta.totalPages,
            totalItems: meta.total,
            pageSize: meta.limit,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyMessage="No shipments found."
        />
      </div>

      {/* Dispatch Modal */}
      <DispatchModal
        isOpen={isDispatchOpen}
        onClose={() => setIsDispatchOpen(false)}
        shipment={selectedShipment}
      />
    </div>
  );
};

export default ShipmentsPage;
