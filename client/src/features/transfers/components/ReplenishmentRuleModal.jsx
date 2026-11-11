/**
 * StockPilot WMS - Min/Max Forward Pick Replenishment Rule Modal.
 *
 * Configures picking-face bin replenishment thresholds, minimum trigger levels,
 * and maximum bin fill capacities.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sliders, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { upsertReplenishmentRule } from '../transfersApi.js';

/**
 * Inner replenishment rule configuration form.
 *
 * @param {object} props - Component properties.
 * @param {Function} props.onClose - Modal close handler.
 * @param {object} [props.initialRule] - Optional rule to edit.
 * @returns {JSX.Element}
 */
const ReplenishmentRuleForm = ({ onClose, initialRule }) => {
  const queryClient = useQueryClient();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    initialRule?.warehouse?._id || initialRule?.warehouse || '',
  );
  const [productId, setProductId] = useState(
    initialRule?.product?._id || initialRule?.product || '',
  );
  const [locationId, setLocationId] = useState(
    initialRule?.location?._id || initialRule?.location || '',
  );
  const [minQuantity, setMinQuantity] = useState(initialRule?.minQuantity ?? 20);
  const [maxQuantity, setMaxQuantity] = useState(initialRule?.maxQuantity ?? 100);
  const [formError, setFormError] = useState('');

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];
  const warehouseId = selectedWarehouseId || warehouses[0]?.id || warehouses[0]?._id || '';

  // Fetch products (limit capped at 100)
  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });
  const products = productsData?.items || [];

  // Fetch locations for selected warehouse (limit capped at 100)
  const { data: locationsData } = useQuery({
    queryKey: ['locations-picking', warehouseId],
    queryFn: () => fetchLocations({ warehouse: warehouseId, limit: 100 }),
    enabled: Boolean(warehouseId),
  });
  const locations = locationsData?.items || [];
  const binsOnly = locations.filter((loc) => loc.type === 'BIN');
  const selectableBins = binsOnly.length > 0 ? binsOnly : locations;

  const mutation = useMutation({
    mutationFn: upsertReplenishmentRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['replenishment-rules'] });
      queryClient.invalidateQueries({ queryKey: ['replenishment-needs'] });
      onClose();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to configure replenishment rule',
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!warehouseId) {
      setFormError('Please select a warehouse.');
      return;
    }
    if (!productId) {
      setFormError('Please select a product.');
      return;
    }
    if (!locationId) {
      setFormError('Please select a forward pick location.');
      return;
    }

    const minQty = Number(minQuantity);
    const maxQty = Number(maxQuantity);

    if (minQty < 0) {
      setFormError('Minimum quantity threshold cannot be negative.');
      return;
    }
    if (maxQty <= minQty) {
      setFormError('Maximum capacity must be strictly greater than minimum threshold.');
      return;
    }

    mutation.mutate({
      warehouse: warehouseId,
      product: productId,
      location: locationId,
      minQuantity: minQty,
      maxQuantity: maxQty,
      isActive: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Warehouse Facility
        </label>
        <Select
          value={warehouseId}
          onChange={(e) => {
            setSelectedWarehouseId(e.target.value);
            setLocationId('');
          }}
          options={warehouses.map((wh) => ({
            value: wh.id || wh._id,
            label: `${wh.code} - ${wh.name}`,
          }))}
          placeholder="Select warehouse..."
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Product to Monitor
          </label>
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={products.map((p) => ({
              value: p.id || p._id,
              label: `${p.sku} - ${p.name}`,
            }))}
            placeholder="Select product..."
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Forward Picking Bin (Face)
          </label>
          <Select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            options={selectableBins.map((loc) => ({
              value: loc.id || loc._id,
              label: `${loc.code} (${loc.path || loc.purpose})`,
            }))}
            placeholder="Select pick bin..."
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Min Quantity Threshold (Reorder Trigger)
          </label>
          <Input
            type="number"
            min="0"
            value={minQuantity}
            onChange={(e) => setMinQuantity(e.target.value)}
            placeholder="e.g. 20"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            When available bin stock drops below this number, a replenishment wave is triggered.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Max Quantity Capacity (Target Fill)
          </label>
          <Input
            type="number"
            min="1"
            value={maxQuantity}
            onChange={(e) => setMaxQuantity(e.target.value)}
            placeholder="e.g. 100"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Target stock level to top up the forward pick bin to.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          isLoading={mutation.isPending}
          disabled={mutation.isPending}
        >
          <Sliders className="w-4 h-4 mr-1.5" />
          Save Replenishment Rule
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Replenishment Rule.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @param {object} [props.initialRule] - Existing rule to edit.
 * @returns {JSX.Element|null}
 */
export const ReplenishmentRuleModal = ({ isOpen, onClose, initialRule }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialRule ? 'Edit Replenishment Rule' : 'Configure Forward Pick Replenishment Rule'}
      size="lg"
    >
      <ReplenishmentRuleForm onClose={onClose} initialRule={initialRule} />
    </Modal>
  );
};

export default ReplenishmentRuleModal;
