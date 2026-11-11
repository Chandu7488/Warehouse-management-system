/**
 * StockPilot WMS - Purchase Orders Management Page.
 *
 * Implements procurement order lists, supplier tracking, fulfillment statuses,
 * and direct transition into dock goods receipt workflows.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Eye, ArrowDownToLine, ShoppingCart } from 'lucide-react';
import { fetchPurchaseOrders } from '../purchasingApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchSuppliers } from '@/features/suppliers/suppliersApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import { formatMoney } from '@/lib/money.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import PurchaseOrderModal from '../components/PurchaseOrderModal.jsx';
import PurchaseOrderDetailModal from '../components/PurchaseOrderDetailModal.jsx';
import GoodsReceiptModal from '@/features/inbound/components/GoodsReceiptModal.jsx';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  CONFIRMED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Purchase Orders Page component.
 *
 * @returns {JSX.Element}
 */
export const PurchaseOrdersPage = () => {
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.PURCHASING_WRITE);
  const canReceive = userCan(PERMISSIONS.RECEIVING_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [receivePoTarget, setReceivePoTarget] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => fetchSuppliers({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'purchase-orders',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        supplier: supplierFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchPurchaseOrders({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        supplier: supplierFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const purchaseOrders = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];
  const suppliers = suppliersData?.items || [];

  const handleOpenDetail = (po) => {
    setSelectedPo(po);
    setIsDetailOpen(true);
  };

  const handleTriggerReceive = (po) => {
    setReceivePoTarget(po);
  };

  const columns = [
    {
      key: 'poNumber',
      header: 'PO Number',
      render: (row) => (
        <button
          onClick={() => handleOpenDetail(row)}
          className="font-semibold text-indigo-600 hover:text-indigo-800 text-left font-mono"
        >
          {row.poNumber}
        </button>
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
      header: 'Warehouse',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {row.warehouse?.code || 'N/A'}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Lines / Units',
      render: (row) => {
        const lines = row.items?.length || 0;
        const totalUnits = row.items?.reduce((s, i) => s + (i.orderedQty || 0), 0) || 0;
        return (
          <span className="text-xs text-slate-600">
            {lines} {lines === 1 ? 'line' : 'lines'} ({totalUnits} units)
          </span>
        );
      },
    },
    {
      key: 'totalMinor',
      header: 'Total Value',
      render: (row) => (
        <span className="font-semibold text-slate-900">
          {formatMoney(row.totalMinor || 0)}
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
      key: 'expectedDeliveryDate',
      header: 'Expected Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.expectedDeliveryDate
            ? new Date(row.expectedDeliveryDate).toLocaleDateString()
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenDetail(row)}
            className="p-1 h-7 text-slate-600 hover:text-slate-900"
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {canReceive &&
            (row.status === 'CONFIRMED' || row.status === 'PARTIALLY_RECEIVED') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTriggerReceive(row)}
                className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1"
                title="Receive Goods at Dock"
              >
                <ArrowDownToLine className="h-3 w-3" />
                Receive
              </Button>
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-indigo-600" />
            Purchase Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Author purchase contracts, track vendor fulfillments, and process inbound dock deliveries
          </p>
        </div>

        {canWrite && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <Input
          placeholder="Search PO #..."
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
          value={supplierFilter}
          onChange={(e) => {
            setSupplierFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id || s._id} value={s.id || s._id}>
              {s.name} ({s.code})
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
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PARTIALLY_RECEIVED">Partially Received</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      {/* PO Data Table */}
      <DataTable
        columns={columns}
        data={purchaseOrders}
        loading={isLoading}
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
        emptyMessage="No purchase orders found matching current criteria"
      />

      {/* Create Modal */}
      <PurchaseOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Inspection Modal */}
      <PurchaseOrderDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        po={selectedPo}
        onReceive={(po) => handleTriggerReceive(po)}
        canWrite={canWrite}
      />

      {/* Dock Receiving Modal */}
      <GoodsReceiptModal
        isOpen={Boolean(receivePoTarget)}
        onClose={() => setReceivePoTarget(null)}
        prefillPo={receivePoTarget}
      />
    </div>
  );
};

export default PurchaseOrdersPage;
