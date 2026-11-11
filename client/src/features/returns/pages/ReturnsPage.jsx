/**
 * StockPilot WMS - Returns & Reverse Logistics Management Page.
 *
 * Coordinates customer return authorizations (RMA), supplier return claims,
 * dock receiving, quality control grading, and ledger dispositions.
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
  ArrowDownToLine,
  ClipboardCheck,
} from 'lucide-react';
import { fetchReturnOrders } from '../returnsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import DataTable from '@/components/ui/DataTable.jsx';
import CreateReturnModal from '../components/CreateReturnModal.jsx';
import ReturnDetailModal from '../components/ReturnDetailModal.jsx';
import ReceiveReturnModal from '../components/ReceiveReturnModal.jsx';
import InspectDispositionModal from '../components/InspectDispositionModal.jsx';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  PENDING_RECEIPT: 'info',
  RECEIVED: 'warning',
  UNDER_INSPECTION: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Returns Page component.
 *
 * @returns {JSX.Element}
 */
export const ReturnsPage = () => {
  const { can: userCan } = useAuth();
  const canWrite =
    userCan(PERMISSIONS.RETURNS_WRITE) || userCan(PERMISSIONS.ORDERS_WRITE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedRma, setSelectedRma] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [inspectTarget, setInspectTarget] = useState(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'return-orders',
      {
        page,
        limit: pageSize,
        search,
        warehouse: warehouseFilter || undefined,
        returnType: typeFilter || undefined,
        status: statusFilter || undefined,
      },
    ],
    queryFn: () =>
      fetchReturnOrders({
        page,
        limit: pageSize,
        search: search || undefined,
        warehouse: warehouseFilter || undefined,
        returnType: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const returnOrders = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, limit: pageSize, totalPages: 1 };
  const warehouses = warehousesData?.items || [];

  const handleOpenDetail = (rma) => {
    setSelectedRma(rma);
    setIsDetailOpen(true);
  };

  const handleOpenReceive = (rma) => {
    setReceiveTarget(rma);
    setIsReceiveOpen(true);
  };

  const handleOpenInspect = (rma) => {
    setInspectTarget(rma);
    setIsInspectOpen(true);
  };

  const columns = [
    {
      key: 'rmaNumber',
      header: 'RMA #',
      render: (row) => (
        <button
          type="button"
          onClick={() => handleOpenDetail(row)}
          className="font-mono text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
        >
          {row.rmaNumber}
        </button>
      ),
    },
    {
      key: 'returnType',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.returnType === 'CUSTOMER_RETURN' ? 'info' : 'secondary'}>
          {row.returnType === 'CUSTOMER_RETURN' ? 'Customer RMA' : 'Supplier Return'}
        </Badge>
      ),
    },
    {
      key: 'partner',
      header: 'Trading Partner',
      render: (row) => {
        const isCustomer = row.returnType === 'CUSTOMER_RETURN';
        const partner = isCustomer ? row.customer : row.supplier;
        return (
          <div>
            <span className="font-semibold text-slate-900 block text-xs truncate max-w-xs">
              {partner?.name || 'N/A'}
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {partner?.code || (isCustomer ? 'Customer' : 'Vendor')}
            </span>
          </div>
        );
      },
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => (
        <span className="text-xs text-slate-700">
          {row.warehouse?.name || 'Facility'}{' '}
          <span className="font-mono text-slate-400">({row.warehouse?.code})</span>
        </span>
      ),
    },
    {
      key: 'itemsSummary',
      header: 'Items',
      render: (row) => {
        const items = row.items || [];
        const expTotal = items.reduce((s, it) => s + (it.expectedQty || 0), 0);
        const recTotal = items.reduce((s, it) => s + (it.receivedQty || 0), 0);
        return (
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{items.length} lines</span>
            <div className="text-[11px] text-slate-500">
              Rec: {recTotal} / {expTotal} units
            </div>
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
      key: 'trackingNumber',
      header: 'Tracking #',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600 truncate max-w-xs block">
          {row.trackingNumber || '-'}
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
            onClick={() => handleOpenDetail(row)}
            title="View Details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          {(row.status === 'PENDING_RECEIPT' || row.status === 'DRAFT') && canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenReceive(row)}
              title="Record Dock Receipt"
              className="text-indigo-600 hover:text-indigo-800"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          )}

          {(row.status === 'RECEIVED' || row.status === 'UNDER_INSPECTION') && canWrite && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenInspect(row)}
              title="Quality Inspection & Disposition"
              className="text-emerald-600 hover:text-emerald-800"
            >
              <ClipboardCheck className="h-4 w-4" />
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
            Returns &amp; Reverse Logistics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Customer RMA authorizations, vendor return claims, QA grading, and inventory dispositions.
          </p>
        </div>

        {canWrite && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Return (RMA)
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
            placeholder="Search RMA #, tracking..."
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
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All Return Types' },
            { value: 'CUSTOMER_RETURN', label: 'Customer RMA' },
            { value: 'SUPPLIER_RETURN', label: 'Supplier Return' },
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
            { value: 'PENDING_RECEIPT', label: 'Pending Receipt' },
            { value: 'RECEIVED', label: 'Received at Dock' },
            { value: 'UNDER_INSPECTION', label: 'Under Inspection' },
            { value: 'COMPLETED', label: 'Completed' },
            { value: 'CANCELLED', label: 'Cancelled' },
          ]}
        />
      </div>

      {/* Returns Table */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <DataTable
          columns={columns}
          data={returnOrders}
          isLoading={isLoading}
          pagination={{
            page: meta.page,
            totalPages: meta.totalPages,
            totalItems: meta.total,
            pageSize: meta.limit,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyMessage="No return orders found matching your filter criteria."
        />
      </div>

      {/* Creation Modal */}
      <CreateReturnModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Detail Modal */}
      <ReturnDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        rma={selectedRma}
        onReceiveDock={handleOpenReceive}
        onInspect={handleOpenInspect}
        canWrite={canWrite}
      />

      {/* Dock Intake Modal */}
      <ReceiveReturnModal
        isOpen={isReceiveOpen}
        onClose={() => setIsReceiveOpen(false)}
        rma={receiveTarget}
      />

      {/* QA Inspection Modal */}
      <InspectDispositionModal
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
        rma={inspectTarget}
      />
    </div>
  );
};

export default ReturnsPage;
