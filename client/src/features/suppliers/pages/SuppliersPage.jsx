/**
 * StockPilot WMS - Supplier management page component.
 *
 * Provides controls for listing, searching, creating, editing, and
 * deactivating supplier partner accounts.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search, Edit2, AlertCircle } from 'lucide-react';
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
} from '../suppliersApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

const supplierFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(50)
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200),
  email: z.string().trim().email('Invalid email address').or(z.literal('')).default(''),
  phone: z.string().trim().max(30).default(''),
  paymentTermsDays: z.coerce.number().int().min(0, 'Must be 0 or greater').default(0),
  notes: z.string().trim().max(1000).default(''),
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
 * Renders the suppliers management page view.
 *
 * @returns {JSX.Element} Suppliers page.
 */
const SuppliersPage = () => {
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.PARTNERS_WRITE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deactivatingSupplier, setDeactivatingSupplier] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['suppliers', { search, page }],
    queryFn: () => fetchSuppliers({ search, page, limit: 10 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      code: '',
      name: '',
      email: '',
      phone: '',
      paymentTermsDays: 0,
      notes: '',
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
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to create supplier',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSupplier(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      setEditingSupplier(null);
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to update supplier',
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeactivatingSupplier(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to deactivate supplier',
      );
      setDeactivatingSupplier(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateSupplier(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to toggle supplier status',
      );
    },
  });

  const openCreateModal = () => {
    setActionError(null);
    setEditingSupplier(null);
    reset({
      code: '',
      name: '',
      email: '',
      phone: '',
      paymentTermsDays: 0,
      notes: '',
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

  const openEditModal = (supplier) => {
    setActionError(null);
    setEditingSupplier(supplier);
    reset({
      code: supplier.code,
      name: supplier.name,
      email: supplier.email || '',
      phone: supplier.phone || '',
      paymentTermsDays: supplier.paymentTermsDays ?? 0,
      notes: supplier.notes || '',
      address: {
        line1: supplier.address?.line1 || '',
        line2: supplier.address?.line2 || '',
        city: supplier.address?.city || '',
        state: supplier.address?.state || '',
        postalCode: supplier.address?.postalCode || '',
        country: supplier.address?.country || '',
      },
    });
    setIsModalOpen(true);
  };

  const onSubmitForm = async (values) => {
    setActionError(null);
    if (editingSupplier) {
      const { code, ...updatePayload } = values;
      void code;
      await updateMutation.mutateAsync({ id: editingSupplier.id, payload: updatePayload });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = [
    {
      header: 'Code & Name',
      key: 'name',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {row.code}
            </span>
            <span className="font-semibold text-slate-900">{row.name}</span>
          </div>
          {row.notes && <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{row.notes}</p>}
        </div>
      ),
    },
    {
      header: 'Contact',
      key: 'contact',
      render: (row) => (
        <div className="text-xs">
          {row.email && <div className="text-slate-900">{row.email}</div>}
          {row.phone && <div className="text-slate-500">{row.phone}</div>}
          {!row.email && !row.phone && <span className="text-slate-400">-</span>}
        </div>
      ),
    },
    {
      header: 'Location',
      key: 'location',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {[row.address?.city, row.address?.country].filter(Boolean).join(', ') || '-'}
        </span>
      ),
    },
    {
      header: 'Payment Terms',
      key: 'paymentTermsDays',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700">
          {row.paymentTermsDays > 0 ? `Net ${row.paymentTermsDays} Days` : 'Immediate'}
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
                    onClick={() => setDeactivatingSupplier(row)}
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Maintain vendor directories, contact records, and commercial purchase payment terms.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Supplier
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
            placeholder="Search suppliers by name or code..."
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load suppliers: {error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="No suppliers registered yet."
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
        title={editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Supplier Code"
              placeholder="e.g. SUP-GLOBAL-01"
              disabled={Boolean(editingSupplier)}
              error={errors.code?.message}
              {...register('code')}
            />

            <Input
              label="Supplier Name"
              placeholder="e.g. Global Tech Distributors Inc."
              error={errors.name?.message}
              {...register('name')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              placeholder="orders@vendor.com"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Phone Number"
              placeholder="+1-555-0199"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Address Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Address Line 1"
                placeholder="Street address"
                {...register('address.line1')}
              />
              <Input
                label="Address Line 2"
                placeholder="Suite, building, apt"
                {...register('address.line2')}
              />
              <Input label="City" placeholder="City" {...register('address.city')} />
              <Input label="State / Province" placeholder="State" {...register('address.state')} />
              <Input
                label="Postal Code"
                placeholder="Zip / Postal code"
                {...register('address.postalCode')}
              />
              <Input label="Country" placeholder="Country" {...register('address.country')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Payment Terms (Days)"
              type="number"
              min="0"
              placeholder="0 (immediate) or 30 (Net 30)"
              error={errors.paymentTermsDays?.message}
              {...register('paymentTermsDays')}
            />

            <Input
              label="Notes"
              placeholder="Account numbers, contacts, special terms..."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingSupplier ? 'Save Changes' : 'Register Supplier'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivatingSupplier)}
        onClose={() => setDeactivatingSupplier(null)}
        onConfirm={() => deactivatingSupplier && deactivateMutation.mutate(deactivatingSupplier.id)}
        title="Deactivate Supplier"
        message={`Are you sure you want to deactivate supplier "${deactivatingSupplier?.name}" (${deactivatingSupplier?.code})?`}
        confirmText="Deactivate"
        confirmVariant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default SuppliersPage;
