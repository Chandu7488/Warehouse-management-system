/**
 * StockPilot WMS - Create Cycle Count Plan Modal.
 *
 * Configures cycle count sessions with scope definitions (warehouse, locations, products),
 * blind count controls, and optional immediate snapshot execution.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, AlertCircle, Play } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { createCycleCountPlan, startCycleCount } from '../countsApi.js';

/**
 * Inner form for creating a Cycle Count Plan.
 *
 * @param {object} props
 * @param {Function} props.onClose
 * @returns {JSX.Element}
 */
const CreateCountPlanForm = ({ onClose }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('CYCLE_COUNT');
  const [blindCount, setBlindCount] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [startImmediately, setStartImmediately] = useState(true);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];

  const activeWarehouseId =
    warehouseId ||
    warehouses.find((w) => w.code === 'WH-MAIN')?.id ||
    warehouses[0]?.id ||
    warehouses[0]?._id ||
    '';

  const { data: locationsData } = useQuery({
    queryKey: ['locations-for-count', activeWarehouseId],
    queryFn: () => fetchLocations({ warehouse: activeWarehouseId, limit: 100 }),
    enabled: Boolean(activeWarehouseId),
  });
  const locations = locationsData?.items || [];

  const { data: productsData } = useQuery({
    queryKey: ['products-for-count'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });
  const products = productsData?.items || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!activeWarehouseId) {
        throw new Error('Please select a target warehouse');
      }

      const scope = {};
      if (selectedLocationId) {
        scope.locations = [selectedLocationId];
      }
      if (selectedProductId) {
        scope.products = [selectedProductId];
      }

      const countDoc = await createCycleCountPlan({
        type,
        warehouse: activeWarehouseId,
        blindCount,
        scope,
        notes: notes.trim(),
      });

      const countId = countDoc.id || countDoc._id;
      if (startImmediately && countId) {
        await startCycleCount(countId);
      }

      return countDoc;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      onClose();
      const countId = data.id || data._id;
      if (countId) {
        navigate(`/counts/${countId}`);
      }
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create count plan');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Target Facility / Warehouse *
          </label>
          <Select
            value={activeWarehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
              setSelectedLocationId('');
            }}
          >
            {warehouses.map((w) => {
              const id = w.id || w._id;
              return (
                <option key={id} value={id}>
                  {w.code} - {w.name}
                </option>
              );
            })}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Audit Type *
          </label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="CYCLE_COUNT">Routine Cycle Count</option>
            <option value="FULL_PHYSICAL">Full Physical Inventory Audit</option>
            <option value="SPOT_CHECK">Targeted Spot Check</option>
          </Select>
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Audit Scope (Leave blank to count entire facility)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Filter by Location / Bin
            </label>
            <Select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
            >
              <option value="">All Locations in Warehouse</option>
              {locations.map((loc) => {
                const id = loc.id || loc._id;
                return (
                  <option key={id} value={id}>
                    {loc.code} ({loc.type} · {loc.purpose})
                  </option>
                );
              })}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Filter by Specific Product
            </label>
            <Select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">All Active Products</option>
              {products.map((prod) => {
                const id = prod.id || prod._id;
                return (
                  <option key={id} value={id}>
                    {prod.sku} - {prod.name}
                  </option>
                );
              })}
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={blindCount}
            onChange={(e) => setBlindCount(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-900">
              Enforce Blind Counting
            </span>
            <p className="text-xs text-slate-500">
              Hides expected on-hand quantities from warehouse operators to ensure unbiased count integrity.
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={startImmediately}
            onChange={(e) => setStartImmediately(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <div>
            <span className="text-sm font-medium text-slate-900">
              Start Counting Immediately
            </span>
            <p className="text-xs text-slate-500">
              Freezes stock balance snapshots right now and transitions session directly to In Progress.
            </p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Audit Notes &amp; Instructions
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Annual physical count for Aisle 1 and 2 high-velocity hardware"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={createMutation.isPending}
          icon={startImmediately ? Play : ClipboardCheck}
        >
          {startImmediately ? 'Freeze Snapshot & Start Count' : 'Create Draft Plan'}
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Cycle Count Planning.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @returns {JSX.Element|null}
 */
export const CreateCountPlanModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Cycle Count Session"
      description="Define the scope and auditing rules to freeze stock balances and initiate physical verification."
      size="lg"
    >
      <CreateCountPlanForm onClose={onClose} />
    </Modal>
  );
};

export default CreateCountPlanModal;
