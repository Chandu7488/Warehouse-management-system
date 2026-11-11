/**
 * StockPilot WMS - Stock Ledger Audit Trail Page.
 *
 * Immutable chronological record of every physical inventory movement,
 * providing complete regulatory traceability, balance checkpoints, and reversal workflow.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { fetchLedgerEntries } from '../inventoryApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import DataTable from '@/components/ui/DataTable.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { ReversalModal } from '../components/ReversalModal.jsx';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';

const MOVEMENT_BADGE_VARIANTS = {
  OPENING_BALANCE: 'info',
  PURCHASE_RECEIPT: 'success',
  PUTAWAY: 'default',
  SALES_ISSUE: 'danger',
  TRANSFER_OUT: 'warning',
  TRANSFER_IN: 'info',
  ADJUSTMENT_GAIN: 'success',
  ADJUSTMENT_LOSS: 'danger',
  CUSTOMER_RETURN: 'success',
  SUPPLIER_RETURN: 'warning',
  WRITE_OFF: 'danger',
  REVERSAL: 'purple',
};

/**
 * Stock Ledger Audit Trail Page component.
 *
 * @returns {JSX.Element}
 */
export default function StockLedgerPage() {
  const { can: userCan } = useAuth();
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reversalTarget, setReversalTarget] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });

  const { data: ledgerData, isLoading } = useQuery({
    queryKey: [
      'inventory-ledger',
      {
        warehouse: warehouseFilter,
        movementType: movementTypeFilter,
        fromDate,
        toDate,
        page,
      },
    ],
    queryFn: () =>
      fetchLedgerEntries({
        warehouse: warehouseFilter || undefined,
        movementType: movementTypeFilter || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        page,
        limit: 20,
      }),
  });

  const warehouses = warehousesData?.items || [];
  const rawItems = ledgerData?.items || [];
  const meta = ledgerData?.meta;

  const items = rawItems.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const sku = e.product?.sku?.toLowerCase() || '';
    const name = e.product?.name?.toLowerCase() || '';
    const loc = e.location?.path?.toLowerCase() || '';
    const ref = e.referenceNo?.toLowerCase() || '';
    return sku.includes(q) || name.includes(q) || loc.includes(q) || ref.includes(q);
  });

  const columns = [
    {
      header: 'Posting Date',
      key: 'postingDate',
      render: (row) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-900">
            {new Date(row.postingDate).toLocaleDateString()}
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            {new Date(row.postingDate).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      header: 'Movement Type',
      key: 'movementType',
      render: (row) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={MOVEMENT_BADGE_VARIANTS[row.movementType] || 'default'}>
            {row.movementType}
          </Badge>
          {row.isReversed && (
            <Badge variant="warning" className="text-[10px] px-1.5 py-0 font-normal">
              Reversed
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Product / SKU',
      key: 'product',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.product?.name}</div>
          <div className="font-mono text-xs text-slate-500">{row.product?.sku}</div>
        </div>
      ),
    },
    {
      header: 'Location Path',
      key: 'location',
      render: (row) => (
        <div>
          <div className="text-xs text-slate-600">{row.warehouse?.code}</div>
          <div className="font-mono text-xs text-indigo-700">{row.location?.path}</div>
        </div>
      ),
    },
    {
      header: 'Quantity Change',
      key: 'quantity',
      render: (row) => {
        const isPos = row.quantity > 0;
        return (
          <span
            className={`font-mono font-bold text-sm ${isPos ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {isPos ? `+${row.quantity}` : row.quantity}
          </span>
        );
      },
    },
    {
      header: 'Balance After',
      key: 'balanceAfter',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
          {row.balanceAfter}
        </span>
      ),
    },
    {
      header: 'Reference & Reason',
      key: 'reference',
      render: (row) => (
        <div className="max-w-xs">
          <div className="font-medium text-xs text-slate-800">
            {row.referenceType} {row.referenceNo && `(${row.referenceNo})`}
          </div>
          {row.reason && (
            <div className="text-[11px] text-slate-500 truncate" title={row.reason}>
              {row.reason}
            </div>
          )}
          {row.isReversed && row.reversalInfo?.referenceNo && (
            <div className="text-[10px] text-amber-700 font-mono mt-0.5">
              Reversed by {row.reversalInfo.referenceNo}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Actor',
      key: 'createdBy',
      render: (row) => (
        <div className="text-xs text-slate-600">
          {row.createdBy?.firstName
            ? `${row.createdBy.firstName} ${row.createdBy.lastName || ''}`
            : 'System / Admin'}
        </div>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        if (!userCan(PERMISSIONS.INVENTORY_REVERSE)) return null;
        if (row.movementType === 'REVERSAL') return null;

        if (row.isReversed) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-50 rounded border border-slate-200/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              Reversed
            </span>
          );
        }

        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setReversalTarget(row)}
            className="flex items-center gap-1 text-xs py-1 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reverse
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to="/inventory"
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">
              Stock Movement Ledger
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Append-only regulatory audit trail of all receipts, issues, transfers, and adjustments.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="purple"
            className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            Immutable Audit Trail
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <Input
            placeholder="Search SKU, name, or ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
            value={movementTypeFilter}
            onChange={(e) => {
              setMovementTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Movement Types</option>
            <option value="OPENING_BALANCE">Opening Balance</option>
            <option value="PURCHASE_RECEIPT">Purchase Receipt (GRN)</option>
            <option value="PUTAWAY">Putaway</option>
            <option value="SALES_ISSUE">Sales Issue (Dispatch)</option>
            <option value="TRANSFER_OUT">Transfer Out</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="ADJUSTMENT_GAIN">Adjustment Gain</option>
            <option value="ADJUSTMENT_LOSS">Adjustment Loss</option>
            <option value="CUSTOMER_RETURN">Customer Return</option>
            <option value="SUPPLIER_RETURN">Supplier Return</option>
            <option value="WRITE_OFF">Write Off</option>
            <option value="REVERSAL">Reversal</option>
          </Select>

          <Input
            type="date"
            placeholder="From Date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />

          <Input
            type="date"
            placeholder="To Date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          pagination={meta}
          onPageChange={setPage}
        />
      </div>

      {reversalTarget && (
        <ReversalModal
          isOpen={Boolean(reversalTarget)}
          onClose={() => setReversalTarget(null)}
          targetEntry={reversalTarget}
        />
      )}
    </div>
  );
}
