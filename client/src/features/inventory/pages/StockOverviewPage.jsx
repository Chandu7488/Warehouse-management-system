/**
 * StockPilot WMS - Stock Overview Page.
 *
 * Real-time visibility into inventory levels, on-hand balances, reserved allocations,
 * and available stock across physical warehouse locations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Boxes, Layers, ShieldAlert, ArrowRightLeft, Plus, BookOpen } from 'lucide-react';
import { fetchBalances } from '../inventoryApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchCategories } from '@/features/categories/categoriesApi.js';
import DataTable from '@/components/ui/DataTable.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { OpeningBalanceModal } from '../components/OpeningBalanceModal.jsx';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';

/**
 * Stock Overview Page component.
 *
 * @returns {JSX.Element}
 */
export default function StockOverviewPage() {
  const { can: userCan } = useAuth();
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-list'],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const { data: balancesData, isLoading } = useQuery({
    queryKey: [
      'inventory-balances',
      { warehouse: warehouseFilter, category: categoryFilter, inStockOnly, page },
    ],
    queryFn: () =>
      fetchBalances({
        warehouse: warehouseFilter || undefined,
        category: categoryFilter || undefined,
        inStockOnly: inStockOnly ? 'true' : 'false',
        page,
        limit: 20,
      }),
  });

  const warehouses = warehousesData?.items || [];
  const categories = categoriesData?.items || [];
  const rawItems = balancesData?.items || [];
  const meta = balancesData?.meta;

  const items = rawItems.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const sku = b.product?.sku?.toLowerCase() || '';
    const name = b.product?.name?.toLowerCase() || '';
    const loc = b.location?.path?.toLowerCase() || '';
    const batch = b.batch?.batchNumber?.toLowerCase() || '';
    return sku.includes(q) || name.includes(q) || loc.includes(q) || batch.includes(q);
  });

  const totalOnHand = rawItems.reduce((acc, b) => acc + (b.onHand || 0), 0);
  const totalReserved = rawItems.reduce((acc, b) => acc + (b.reserved || 0), 0);
  const totalAvailable = Math.max(0, totalOnHand - totalReserved);

  const columns = [
    {
      header: 'Product / SKU',
      key: 'product',
      render: (row) => (
        <div>
          <div className="font-semibold text-slate-900">{row.product?.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              {row.product?.sku}
            </span>
            {row.product?.trackingType && row.product.trackingType !== 'NONE' && (
              <Badge variant="info">{row.product.trackingType}</Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Warehouse & Location',
      key: 'location',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800">{row.warehouse?.name}</div>
          <div className="font-mono text-xs text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded inline-block mt-0.5">
            {row.location?.path}
          </div>
        </div>
      ),
    },
    {
      header: 'Lot / Batch',
      key: 'batch',
      render: (row) => {
        if (!row.batch) return <span className="text-slate-400 text-xs">-</span>;
        return (
          <div>
            <div className="font-mono font-medium text-xs text-slate-800">
              {row.batch.batchNumber}
            </div>
            {row.batch.expiresOn && (
              <div className="text-[11px] text-slate-500">
                Exp: {new Date(row.batch.expiresOn).toLocaleDateString()}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'On Hand',
      key: 'onHand',
      render: (row) => (
        <span className="font-semibold text-slate-900">
          {row.onHand}{' '}
          <span className="text-xs font-normal text-slate-500">{row.product?.unit?.code}</span>
        </span>
      ),
    },
    {
      header: 'Reserved',
      key: 'reserved',
      render: (row) => (
        <span className={row.reserved > 0 ? 'font-semibold text-amber-600' : 'text-slate-400'}>
          {row.reserved || 0}
        </span>
      ),
    },
    {
      header: 'Available',
      key: 'available',
      render: (row) => {
        const avail = Math.max(0, (row.onHand || 0) - (row.reserved || 0));
        return (
          <Badge variant={avail > 0 ? 'success' : 'neutral'}>
            {avail} {row.product?.unit?.code}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory Stock & Balances
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time physical stock balances, reserved orders, and storage bin allocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/inventory/ledger">
            <Button variant="secondary" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Stock Ledger
            </Button>
          </Link>

          {userCan(PERMISSIONS.INVENTORY_OPENING) && (
            <Button onClick={() => setIsOpeningModalOpen(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Post Opening Stock
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Stock Records</p>
              <p className="text-xl font-bold text-slate-900">{meta?.total ?? rawItems.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">On-Hand Total</p>
              <p className="text-xl font-bold text-emerald-600">{totalOnHand}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-50 p-2.5 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Reserved for Orders</p>
              <p className="text-xl font-bold text-amber-600">{totalReserved}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Available to Promise</p>
              <p className="text-xl font-bold text-blue-600">{totalAvailable}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            placeholder="Search SKU, name, bin, or lot..."
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
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.name}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="inStockCheck"
              checked={inStockOnly}
              onChange={(e) => {
                setInStockOnly(e.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="inStockCheck" className="text-xs font-medium text-slate-700">
              In-Stock Only (onHand &gt; 0)
            </label>
          </div>
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

      {isOpeningModalOpen && (
        <OpeningBalanceModal
          isOpen={isOpeningModalOpen}
          onClose={() => setIsOpeningModalOpen(false)}
          defaultWarehouseId={warehouseFilter}
        />
      )}
    </div>
  );
}
