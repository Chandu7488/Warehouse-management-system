/**
 * StockPilot WMS - Opening Balance Entry Modal.
 *
 * Allows privileged warehouse operators to post initial inventory balances
 * to specific storage bins with batch and tracking validation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { LocationPicker } from '@/components/locations/LocationPicker.jsx';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { postOpeningBalance } from '../inventoryApi.js';
import { toMinorUnits, toMajorUnits } from '@/lib/money.js';

const openingFormSchema = z.object({
  warehouse: z.string().min(1, 'Warehouse is required'),
  product: z.string().min(1, 'Product is required'),
  location: z.string().min(1, 'Storage location is required'),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitCost: z.coerce.number().min(0, 'Unit cost cannot be negative'),
  batchNumber: z.string().optional(),
  expiresOn: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Opening Balance Modal component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Dismiss modal callback.
 * @param {string} [props.defaultWarehouseId] - Preselected warehouse identifier.
 * @returns {JSX.Element}
 */
export const OpeningBalanceModal = ({ isOpen, onClose, defaultWarehouseId }) => {
  const queryClient = useQueryClient();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(defaultWarehouseId || '');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
    enabled: isOpen,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list-all'],
    queryFn: () => fetchProducts({ limit: 100, isActive: 'true' }),
    enabled: isOpen,
  });

  const warehouses = warehousesData?.items || [];
  const products = productsData?.items || [];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(openingFormSchema),
    defaultValues: {
      warehouse: defaultWarehouseId || '',
      product: '',
      location: '',
      quantity: 1,
      unitCost: 0,
      batchNumber: '',
      expiresOn: '',
      reason: 'Initial Opening Stock Entry',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload) => postOpeningBalance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-availability'] });
      onClose();
      reset();
      setSelectedLocationId('');
      setSelectedProduct(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to post opening balance',
      );
    },
  });

  const handleProductChange = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => p.id === prodId || p._id === prodId);
    setSelectedProduct(prod || null);
    const unitCost = prod?.costPriceMinor ?? prod?.priceMinor;
    if (unitCost !== undefined && unitCost !== null) {
      setValue('unitCost', toMajorUnits(unitCost));
    }
  };

  const onSubmit = async (values) => {
    setActionError(null);
    const unitCostMinor = toMinorUnits(values.unitCost || 0);

    await mutation.mutateAsync({
      warehouse: values.warehouse,
      items: [
        {
          product: values.product,
          location: values.location,
          quantity: Number(values.quantity),
          unitCostMinor,
          batchNumber: values.batchNumber ? values.batchNumber.trim().toUpperCase() : undefined,
          expiresOn: values.expiresOn || undefined,
          reason: values.reason || 'Initial Opening Stock Entry',
        },
      ],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post Opening Stock Balance" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {actionError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {actionError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Target Warehouse"
            error={errors.warehouse?.message}
            {...register('warehouse', {
              onChange: (e) => {
                setSelectedWarehouseId(e.target.value);
                setSelectedLocationId('');
                setValue('location', '');
              },
            })}
          >
            <option value="">Select Warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id || w._id} value={w.id || w._id}>
                {w.name} ({w.code})
              </option>
            ))}
          </Select>

          <Select
            label="Catalog Product"
            error={errors.product?.message}
            {...register('product', {
              onChange: handleProductChange,
            })}
          >
            <option value="">Select Product</option>
            {products.map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.sku} - {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <LocationPicker
            warehouseId={selectedWarehouseId}
            value={selectedLocationId}
            onChange={(locId) => {
              setSelectedLocationId(locId);
              setValue('location', locId, { shouldValidate: true });
            }}
            error={errors.location?.message}
            disabled={!selectedWarehouseId}
            placeholder={
              selectedWarehouseId
                ? 'Select bin or storage location...'
                : 'Select a warehouse first...'
            }
          />
        </div>

        {(selectedProduct?.trackingType === 'BATCH' || selectedProduct?.tracking === 'BATCH') && (
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-amber-50/50 border border-amber-200 p-3">
            <Input
              label="Batch / Lot Number"
              placeholder="e.g. LOT-2026-A1"
              error={errors.batchNumber?.message}
              {...register('batchNumber')}
            />

            <Input
              label="Expiration Date"
              type="date"
              error={errors.expiresOn?.message}
              {...register('expiresOn')}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Quantity (${selectedProduct?.unit?.code || 'Units'})`}
            type="number"
            step={selectedProduct?.unit?.allowDecimals ? '0.001' : '1'}
            error={errors.quantity?.message}
            {...register('quantity')}
          />

          <Input
            label="Unit Cost ($ USD)"
            type="number"
            step="0.01"
            min="0"
            error={errors.unitCost?.message}
            {...register('unitCost')}
          />
        </div>

        <Input
          label="Audit Reason"
          placeholder="e.g. Fiscal year-end initial count"
          error={errors.reason?.message}
          {...register('reason')}
        />

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting || mutation.isPending}>
            Post Opening Balance
          </Button>
        </div>
      </form>
    </Modal>
  );
};
