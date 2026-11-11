/**
 * StockPilot WMS - Warehouse management page component.
 *
 * Provides administrative controls for listing, searching, creating,
 * editing, and deactivating physical facility warehouses.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Edit2, AlertCircle, FolderTree } from 'lucide-react';
import {
  fetchWarehouses,
  createWarehouse,
  updateWarehouse,
  deactivateWarehouse,
} from '../warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

const warehouseFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20)
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  address: z
    .object({
      line1: z.string().trim().max(100).default(''),
      line2: z.string().trim().max(100).default(''),
      city: z.string().trim().max(50).default(''),
      state: z.string().trim().max(50).default(''),
      postalCode: z.string().trim().max(20).default(''),
      country: z.string().trim().max(50).default(''),
    })
    .default({}),
});

/**
 * Renders the warehouse facilities management page view.
 *
 * @returns {JSX.Element} Warehouses page.
 */
const WarehousesPage = () => {
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.WAREHOUSES_WRITE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [deactivatingWarehouse, setDeactivatingWarehouse] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouses', { search, page }],
    queryFn: () => fetchWarehouses({ search, page, limit: 10 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: {
      code: '',
      name: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to create warehouse',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateWarehouse(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setIsModalOpen(false);
      setEditingWarehouse(null);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to update warehouse',
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateWarehouse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setDeactivatingWarehouse(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to deactivate warehouse',
      );
      setDeactivatingWarehouse(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateWarehouse(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to toggle warehouse status',
      );
    },
  });

  const openCreateModal = () => {
    setActionError(null);
    setEditingWarehouse(null);
    reset({
      code: '',
      name: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
    });
    setIsModalOpen(true);
  };

  const openEditModal = (wh) => {
    setActionError(null);
    setEditingWarehouse(wh);
    reset({
      code: wh.code,
      name: wh.name,
      address: {
        line1: wh.address?.line1 || '',
        line2: wh.address?.line2 || '',
        city: wh.address?.city || '',
        state: wh.address?.state || '',
        postalCode: wh.address?.postalCode || '',
        country: wh.address?.country || '',
      },
    });
    setIsModalOpen(true);
  };

  const onSubmitForm = async (values) => {
    setActionError(null);
    if (editingWarehouse) {
      const { code, ...updatePayload } = values;
      void code;
      await updateMutation.mutateAsync({ id: editingWarehouse.id, payload: updatePayload });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = [
    {
      header: 'Code & Name',
      key: 'name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
            {row.code}
          </span>
          <span className="font-semibold text-slate-900">{row.name}</span>
        </div>
      ),
    },
    {
      header: 'Location',
      key: 'location',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {[row.address?.city, row.address?.state, row.address?.country]
            .filter(Boolean)
            .join(', ') || '-'}
        </span>
      ),
    },
    {
      header: 'Street Address',
      key: 'address',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {[row.address?.line1, row.address?.line2].filter(Boolean).join(' ') || '-'}
        </span>
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
    ...(canWrite
      ? [
          {
            header: 'Actions',
            key: 'actions',
            className: 'text-right',
            render: (row) => (
              <div className="flex items-center justify-end gap-2">
                <Link
                  to={`/warehouses/${row.id}/locations`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                  title="Manage Physical Locations"
                >
                  <FolderTree className="h-3.5 w-3.5" />
                  Locations
                </Link>
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
                    onClick={() => setDeactivatingWarehouse(row)}
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
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Warehouses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Define primary storage facilities, fulfillment distribution centers, and physical sites.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Warehouse
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

      <div className="flex items-center justify-between gap-4">
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
            placeholder="Search warehouses by code or name..."
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load warehouses: {error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="No warehouses defined yet."
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
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWarehouse ? 'Edit Warehouse' : 'Define New Warehouse'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Warehouse Code"
              placeholder="e.g. WH-MAIN, WH-EAST"
              disabled={Boolean(editingWarehouse)}
              error={errors.code?.message}
              {...register('code')}
            />

            <Input
              label="Warehouse Name"
              placeholder="e.g. Central Distribution Center"
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Facility Address
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Street Address"
                placeholder="100 Logistics Blvd"
                {...register('address.line1')}
              />
              <Input
                label="Building / Gate"
                placeholder="Building B, Gate 4"
                {...register('address.line2')}
              />
              <Input label="City" placeholder="Dallas" {...register('address.city')} />
              <Input label="State / Province" placeholder="TX" {...register('address.state')} />
              <Input label="Postal Code" placeholder="75201" {...register('address.postalCode')} />
              <Input label="Country" placeholder="USA" {...register('address.country')} />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingWarehouse ? 'Save Changes' : 'Create Warehouse'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivatingWarehouse)}
        onClose={() => setDeactivatingWarehouse(null)}
        onConfirm={() =>
          deactivatingWarehouse && deactivateMutation.mutate(deactivatingWarehouse.id)
        }
        title="Deactivate Warehouse"
        message={`Are you sure you want to deactivate warehouse "${deactivatingWarehouse?.name}" (${deactivatingWarehouse?.code})?`}
        confirmText="Deactivate"
        confirmVariant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default WarehousesPage;
