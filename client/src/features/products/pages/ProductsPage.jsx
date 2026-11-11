/**
 * StockPilot WMS - Product catalog management page component.
 *
 * Provides administrative controls for listing, searching, filtering, creating,
 * editing, inspecting stock levels, and deactivating catalog items.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Edit2, AlertCircle, Eye, Layers, Calendar } from 'lucide-react';
import {
  fetchProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  fetchProductStock,
} from '../productsApi.js';
import { fetchCategories } from '@/features/categories/categoriesApi.js';
import { fetchUnits } from '@/features/units/unitsApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import { formatMoney, toMinorUnits, toMajorUnits } from '@/lib/money.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

const productFormSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2, 'SKU must be at least 2 characters')
      .max(50)
      .transform((val) => val.toUpperCase()),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200),
    description: z.string().trim().max(1000).optional().default(''),
    category: z.string().min(1, 'Category is required'),
    unit: z.string().min(1, 'Unit of measurement is required'),
    trackingType: z.enum(['NONE', 'BATCH', 'SERIAL']),
    hasExpiry: z.boolean().default(false),
    barcode: z.string().trim().optional().default(''),
    reorderLevel: z.coerce.number().min(0, 'Reorder level cannot be negative').default(0),
    reorderQuantity: z.coerce.number().min(0, 'Reorder quantity cannot be negative').default(0),
    costPrice: z.coerce.number().min(0, 'Cost price cannot be negative').default(0),
    salePrice: z.coerce.number().min(0, 'Sale price cannot be negative').default(0),
    weightKg: z.coerce.number().min(0).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.hasExpiry && data.trackingType !== 'BATCH') {
        return false;
      }
      return true;
    },
    {
      message: 'Expiry tracking is only permitted for products with BATCH tracking',
      path: ['hasExpiry'],
    },
  );

/**
 * Renders the product catalog management page view.
 *
 * @returns {JSX.Element} Products page.
 */
const ProductsPage = () => {
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.MASTER_WRITE);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [trackingFilter, setTrackingFilter] = useState('');
  const [page, setPage] = useState(1);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deactivatingProduct, setDeactivatingProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-lookup'],
    queryFn: () => fetchCategories({ limit: 100, isActive: 'true' }),
  });

  const { data: unitsData } = useQuery({
    queryKey: ['units-lookup'],
    queryFn: () => fetchUnits({ limit: 100, isActive: 'true' }),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'products',
      {
        search,
        category: categoryFilter || undefined,
        trackingType: trackingFilter || undefined,
        page,
      },
    ],
    queryFn: () =>
      fetchProducts({
        search,
        category: categoryFilter || undefined,
        trackingType: trackingFilter || undefined,
        page,
        limit: 10,
      }),
  });

  const { data: stockData, isLoading: isStockLoading } = useQuery({
    queryKey: ['product-stock', stockProduct?.id],
    queryFn: () => fetchProductStock(stockProduct.id),
    enabled: Boolean(stockProduct?.id),
  });

  const [selectedTrackingType, setSelectedTrackingType] = useState('NONE');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      category: '',
      unit: '',
      trackingType: 'NONE',
      hasExpiry: false,
      barcode: '',
      reorderLevel: 0,
      reorderQuantity: 0,
      costPrice: 0,
      salePrice: 0,
      weightKg: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload) => createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsFormModalOpen(false);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to create product',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsFormModalOpen(false);
      setEditingProduct(null);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to update product',
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeactivatingProduct(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to deactivate product.',
      );
      setDeactivatingProduct(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateProduct(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to toggle product status',
      );
    },
  });

  const openCreateModal = () => {
    setActionError(null);
    setEditingProduct(null);
    setSelectedTrackingType('NONE');
    reset({
      sku: '',
      name: '',
      description: '',
      category: categoriesData?.items?.[0]?.id || '',
      unit: unitsData?.items?.[0]?.id || '',
      trackingType: 'NONE',
      hasExpiry: false,
      barcode: '',
      reorderLevel: 0,
      reorderQuantity: 0,
      costPrice: 0,
      salePrice: 0,
      weightKg: null,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (prod) => {
    setActionError(null);
    setEditingProduct(prod);
    setSelectedTrackingType(prod.trackingType || 'NONE');
    reset({
      sku: prod.sku,
      name: prod.name,
      description: prod.description || '',
      category: prod.category?.id || prod.category || '',
      unit: prod.unit?.id || prod.unit || '',
      trackingType: prod.trackingType || 'NONE',
      hasExpiry: Boolean(prod.hasExpiry),
      barcode: prod.barcode || '',
      reorderLevel: prod.reorderLevel ?? 0,
      reorderQuantity: prod.reorderQuantity ?? 0,
      costPrice: toMajorUnits(prod.costPriceMinor ?? 0),
      salePrice: toMajorUnits(prod.salePriceMinor ?? 0),
      weightKg: prod.weightKg ?? null,
    });
    setIsFormModalOpen(true);
  };

  const onSubmitForm = async (values) => {
    setActionError(null);
    const payload = {
      sku: values.sku,
      name: values.name,
      description: values.description,
      category: values.category,
      unit: values.unit,
      trackingType: values.trackingType,
      hasExpiry: values.trackingType === 'BATCH' ? values.hasExpiry : false,
      barcode: values.barcode ? values.barcode : null,
      reorderLevel: Number(values.reorderLevel),
      reorderQuantity: Number(values.reorderQuantity),
      costPriceMinor: toMinorUnits(values.costPrice),
      salePriceMinor: toMinorUnits(values.salePrice),
      weightKg: values.weightKg ? Number(values.weightKg) : null,
    };

    if (editingProduct) {
      const { sku, ...updatePayload } = payload;
      void sku;
      await updateMutation.mutateAsync({ id: editingProduct.id, payload: updatePayload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const trackingBadges = {
    NONE: <Badge variant="neutral">None</Badge>,
    BATCH: <Badge variant="info">Batch</Badge>,
    SERIAL: <Badge variant="indigo">Serial</Badge>,
  };

  const columns = [
    {
      header: 'SKU & Name',
      key: 'name',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {row.sku}
            </span>
            <span className="font-semibold text-slate-900">{row.name}</span>
          </div>
          {row.description && (
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'category',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.category?.name || 'Unassigned'}
        </span>
      ),
    },
    {
      header: 'Unit',
      key: 'unit',
      render: (row) => (
        <span className="text-xs font-mono font-medium text-slate-700">
          {row.unit?.code || '-'}
        </span>
      ),
    },
    {
      header: 'Tracking',
      key: 'trackingType',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {trackingBadges[row.trackingType] || <Badge>{row.trackingType}</Badge>}
          {row.hasExpiry && (
            <span title="Expiry Date Tracked" className="inline-flex items-center text-amber-600">
              <Calendar className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Prices (Cost / Sale)',
      key: 'price',
      render: (row) => (
        <div className="text-xs">
          <span className="text-slate-500">{formatMoney(row.costPriceMinor)}</span>
          <span className="mx-1 text-slate-300">/</span>
          <span className="font-semibold text-slate-900">{formatMoney(row.salePriceMinor)}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'danger'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStockProduct(row)}
            aria-label={`View stock for ${row.name}`}
            title="Inspect Stock Levels"
          >
            <Eye className="h-3.5 w-3.5 text-indigo-600" />
          </Button>
          {canWrite && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditModal(row)}
                aria-label={`Edit ${row.name}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              {row.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setDeactivatingProduct(row)}
                >
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={() => toggleStatusMutation.mutate({ id: row.id, isActive: true })}
                >
                  Activate
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            Maintain item master data, inventory classification, unit mapping, and tracking methods.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by SKU, name or barcode..."
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white text-slate-700 focus:border-indigo-600 focus:outline-none"
          >
            <option value="">All Categories</option>
            {categoriesData?.items?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <select
            value={trackingFilter}
            onChange={(e) => {
              setTrackingFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white text-slate-700 focus:border-indigo-600 focus:outline-none"
          >
            <option value="">All Tracking Types</option>
            <option value="NONE">None</option>
            <option value="BATCH">Batch Tracking</option>
            <option value="SERIAL">Serial Tracking</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load products: {error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="No catalog products found."
        pagination={
          data?.meta
            ? {
                page: data.meta.page,
                totalPages: data.meta.totalPages,
                total: data.meta.total,
                onPageChange: (newPage) => setPage(newPage),
              }
            : null
        }
      />

      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingProduct ? 'Edit Catalog Product' : 'Create New Catalog Product'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="SKU (Stock Keeping Unit)"
              placeholder="e.g. LAPTOP-PRO-15"
              disabled={Boolean(editingProduct)}
              error={errors.sku?.message}
              {...register('sku')}
            />

            <Input
              label="Product Name"
              placeholder="e.g. Pro Laptop 15-inch"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Technical specifications, model notes, or variant details..."
              className="block w-full rounded-lg border border-slate-300 py-2 px-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Category" error={errors.category?.message} {...register('category')}>
              <option value="">Select a Category</option>
              {categoriesData?.items?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>

            <Select
              label="Unit of Measurement (UoM)"
              error={errors.unit?.message}
              {...register('unit')}
            >
              <option value="">Select a Unit</option>
              {unitsData?.items?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code}) {u.allowDecimals ? '[Decimals]' : '[Integer]'}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tracking Type"
              error={errors.trackingType?.message}
              {...register('trackingType', {
                onChange: (e) => {
                  const val = e.target.value;
                  setSelectedTrackingType(val);
                  if (val !== 'BATCH') {
                    setValue('hasExpiry', false);
                  }
                },
              })}
            >
              <option value="NONE">Standard (No Serial/Batch)</option>
              <option value="BATCH">Batch Tracking (Lots / Expiry)</option>
              <option value="SERIAL">Serial Number Tracking</option>
            </Select>

            <Input
              label="Barcode (EAN / UPC / Code128)"
              placeholder="e.g. 793573179008"
              error={errors.barcode?.message}
              {...register('barcode')}
            />
          </div>

          {selectedTrackingType === 'BATCH' && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  {...register('hasExpiry')}
                />
                <span className="text-xs font-semibold text-slate-800">
                  Enable Expiry Date Tracking (Mandatory shelf-life management for batches)
                </span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cost Price ($ USD)"
              type="number"
              step="0.01"
              min="0"
              error={errors.costPrice?.message}
              {...register('costPrice')}
            />

            <Input
              label="Sale Price ($ USD)"
              type="number"
              step="0.01"
              min="0"
              error={errors.salePrice?.message}
              {...register('salePrice')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Reorder Level"
              type="number"
              step="any"
              min="0"
              error={errors.reorderLevel?.message}
              {...register('reorderLevel')}
            />

            <Input
              label="Reorder Quantity"
              type="number"
              step="any"
              min="0"
              error={errors.reorderQuantity?.message}
              {...register('reorderQuantity')}
            />

            <Input
              label="Weight (kg)"
              type="number"
              step="0.001"
              min="0"
              error={errors.weightKg?.message}
              {...register('weightKg')}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(stockProduct)}
        onClose={() => setStockProduct(null)}
        title={`Stock Levels: ${stockProduct?.sku} - ${stockProduct?.name}`}
      >
        {isStockLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading stock balances...</div>
        ) : (
          (() => {
            const stockList = Array.isArray(stockData) ? stockData : stockData?.items || [];
            const onHandTotal = stockList.reduce((sum, b) => sum + (b.onHand || 0), 0);
            const allocatedTotal = stockList.reduce((sum, b) => sum + (b.reserved || 0), 0);
            const availableTotal = Math.max(0, onHandTotal - allocatedTotal);

            const warehouseMap = new Map();
            for (const b of stockList) {
              const whId = b.warehouse?.id || b.warehouse?._id || String(b.warehouse);
              const whName = b.warehouse?.name || 'Warehouse';
              if (!warehouseMap.has(whId)) {
                warehouseMap.set(whId, {
                  warehouseId: whId,
                  warehouseName: whName,
                  onHand: 0,
                  allocated: 0,
                  available: 0,
                });
              }
              const entry = warehouseMap.get(whId);
              entry.onHand += b.onHand || 0;
              entry.allocated += b.reserved || 0;
              entry.available = Math.max(0, entry.onHand - entry.allocated);
            }
            const warehouseBreakdown = Array.from(warehouseMap.values());

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="text-xs text-slate-500">On-Hand</span>
                    <p className="mt-1 text-lg font-bold text-slate-900">{onHandTotal}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="text-xs text-slate-500">Allocated</span>
                    <p className="mt-1 text-lg font-bold text-amber-600">{allocatedTotal}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="text-xs text-slate-500">Available</span>
                    <p className="mt-1 text-lg font-bold text-emerald-600">{availableTotal}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                    Per-Warehouse Breakdown
                  </h3>
                  {warehouseBreakdown.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 p-4 text-center text-xs text-slate-500">
                      <Layers className="mx-auto h-6 w-6 text-slate-400 mb-1" />
                      No inventory currently recorded across warehouses.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 font-semibold">Warehouse</th>
                            <th className="px-3 py-2 font-semibold">On-Hand</th>
                            <th className="px-3 py-2 font-semibold">Allocated</th>
                            <th className="px-3 py-2 font-semibold">Available</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {warehouseBreakdown.map((w) => (
                            <tr key={w.warehouseId}>
                              <td className="px-3 py-2 font-medium">{w.warehouseName}</td>
                              <td className="px-3 py-2">{w.onHand}</td>
                              <td className="px-3 py-2 text-amber-600">{w.allocated}</td>
                              <td className="px-3 py-2 text-emerald-600 font-semibold">
                                {w.available}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end pt-4 border-t border-slate-200">
                  <Button variant="secondary" onClick={() => setStockProduct(null)}>
                    Close
                  </Button>
                </div>
              </div>
            );
          })()
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivatingProduct)}
        onClose={() => setDeactivatingProduct(null)}
        onConfirm={() => deactivatingProduct && deactivateMutation.mutate(deactivatingProduct.id)}
        title="Deactivate Product"
        message={`Are you sure you want to deactivate product "${deactivatingProduct?.name}" (${deactivatingProduct?.sku})?`}
        confirmText="Deactivate"
        confirmVariant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default ProductsPage;
