/**
 * StockPilot WMS - Units of measurement page component.
 *
 * Provides administrative controls for listing, searching, creating,
 * editing, and deactivating measurement units (UoM).
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
import { fetchUnits, createUnit, updateUnit, deactivateUnit } from '../unitsApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

const unitSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Code must be at least 1 character')
    .max(10, 'Code cannot exceed 10 characters')
    .transform((val) => val.toUpperCase()),
  name: z.string().trim().min(1, 'Name must be at least 1 character').max(50),
  allowDecimals: z.boolean().default(false),
});

/**
 * Renders the units of measurement page view.
 *
 * @returns {JSX.Element} Units page.
 */
const UnitsPage = () => {
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.MASTER_WRITE);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [deactivatingUnit, setDeactivatingUnit] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['units', { search, page }],
    queryFn: () => fetchUnits({ search, page, limit: 10 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      code: '',
      name: '',
      allowDecimals: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: createUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsModalOpen(false);
      reset();
    },
    onError: (err) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to create unit');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateUnit(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setIsModalOpen(false);
      setEditingUnit(null);
      reset();
    },
    onError: (err) => {
      setActionError(err.response?.data?.error?.message || err.message || 'Failed to update unit');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateUnit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setDeactivatingUnit(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to deactivate unit. Make sure no active products use it.',
      );
      setDeactivatingUnit(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }) => updateUnit(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to toggle unit status',
      );
    },
  });

  const openCreateModal = () => {
    setActionError(null);
    setEditingUnit(null);
    reset({ code: '', name: '', allowDecimals: false });
    setIsModalOpen(true);
  };

  const openEditModal = (unit) => {
    setActionError(null);
    setEditingUnit(unit);
    reset({
      code: unit.code,
      name: unit.name,
      allowDecimals: unit.allowDecimals,
    });
    setIsModalOpen(true);
  };

  const onSubmitForm = async (values) => {
    setActionError(null);
    if (editingUnit) {
      await updateMutation.mutateAsync({
        id: editingUnit.id,
        payload: {
          name: values.name,
          allowDecimals: values.allowDecimals,
        },
      });
    } else {
      await createMutation.mutateAsync(values);
    }
  };

  const columns = [
    {
      header: 'Code',
      key: 'code',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {row.code}
        </span>
      ),
    },
    {
      header: 'Name',
      key: 'name',
      render: (row) => <span className="font-semibold text-slate-900">{row.name}</span>,
    },
    {
      header: 'Decimals Support',
      key: 'allowDecimals',
      render: (row) => (
        <Badge variant={row.allowDecimals ? 'info' : 'neutral'}>
          {row.allowDecimals ? 'Fractional Allowed' : 'Integer Only'}
        </Badge>
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
      header: 'Created At',
      key: 'createdAt',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
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
                    onClick={() => setDeactivatingUnit(row)}
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Units of Measurement</h1>
          <p className="mt-1 text-sm text-slate-600">
            Define system units (e.g. PCS, KG, BOX) and control fractional decimal quantities.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Unit
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
            placeholder="Search units by code or name..."
            className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load units: {error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyMessage="No units defined yet."
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
        title={editingUnit ? 'Edit Unit of Measurement' : 'Create Unit of Measurement'}
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          <Input
            label="Unit Code"
            placeholder="e.g. PCS, KG, BOX, LTR"
            disabled={Boolean(editingUnit)}
            error={errors.code?.message}
            {...register('code')}
          />

          <Input
            label="Unit Name"
            placeholder="e.g. Pieces, Kilograms, Standard Box"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                {...register('allowDecimals')}
              />
              <div className="text-sm">
                <span className="font-medium text-slate-900">Allow Fractional Decimals</span>
                <p className="text-xs text-slate-500">
                  Enable this for bulk or weight items (e.g. 1.250 KG). Leave disabled for discrete
                  indivisible items (e.g. PCS, Units).
                </p>
              </div>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingUnit ? 'Save Changes' : 'Create Unit'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivatingUnit)}
        onClose={() => setDeactivatingUnit(null)}
        onConfirm={() => deactivatingUnit && deactivateMutation.mutate(deactivatingUnit.id)}
        title="Deactivate Unit"
        message={`Are you sure you want to deactivate unit "${deactivatingUnit?.name}" (${deactivatingUnit?.code})? You will not be able to deactivate it if active products use it.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default UnitsPage;
