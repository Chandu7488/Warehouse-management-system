/**
 * StockPilot WMS - Direct Bin Relocation Modal.
 *
 * Facilitates immediate intra-warehouse relocation between two storage bins
 * with atomic two-leg ledger postings (TRANSFER_OUT / TRANSFER_IN).
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { fetchBalances } from '@/features/inventory/inventoryApi.js';
import { executeDirectBinTransfer } from '../transfersApi.js';

/**
 * Inner direct bin transfer form.
 *
 * @param {object} props - Component properties.
 * @param {Function} props.onClose - Modal close handler.
 * @param {object} [props.initialValues] - Optional pre-filled data.
 * @returns {JSX.Element}
 */
const DirectBinTransferForm = ({ onClose, initialValues = {} }) => {
  const queryClient = useQueryClient();

  const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialValues.warehouse || '');
  const [productId, setProductId] = useState(initialValues.product || '');
  const [sourceLocationId, setSourceLocationId] = useState(initialValues.sourceLocation || '');
  const [destinationLocationId, setDestinationLocationId] = useState(
    initialValues.destinationLocation || '',
  );
  const [quantity, setQuantity] = useState(initialValues.quantity || 1);
  const [notes, setNotes] = useState(initialValues.notes || '');
  const [formError, setFormError] = useState('');

  // Fetch active warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];
  const warehouseId = selectedWarehouseId || warehouses[0]?._id || warehouses[0]?.id || '';

  // Fetch catalog products
  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });
  const products = productsData?.items || [];
  const effectiveProductId = productId || initialValues.product || products[0]?._id || products[0]?.id || '';

  // Fetch bins in selected warehouse (limit capped at 100 by API schema)
  const { data: locationsData } = useQuery({
    queryKey: ['locations-bins', warehouseId],
    queryFn: () => fetchLocations({ warehouse: warehouseId, limit: 100 }),
    enabled: Boolean(warehouseId),
  });
  const locations = locationsData?.items || [];

  // Filter for actual bins (or fallback to all locations)
  const binsOnly = locations.filter((loc) => loc.type === 'BIN');
  const availableBins = binsOnly.length > 0 ? binsOnly : locations;

  // Fetch balances for selected warehouse and product to display available source stock
  const { data: balancesData } = useQuery({
    queryKey: ['balances-direct-transfer', warehouseId, effectiveProductId],
    queryFn: () =>
      fetchBalances({ warehouse: warehouseId, product: effectiveProductId, limit: 100 }),
    enabled: Boolean(warehouseId && effectiveProductId),
  });
  const balances = balancesData?.items || [];

  // Sort bins so those with on-hand/available stock appear at the top
  const sortedBins = [...availableBins].sort((a, b) => {
    const aId = String(a._id || a.id);
    const bId = String(b._id || b.id);
    const aBal = balances.find((bal) => String(bal.location?._id || bal.location?.id || bal.location) === aId);
    const bBal = balances.find((bal) => String(bal.location?._id || bal.location?.id || bal.location) === bId);
    const aQty = aBal?.available || 0;
    const bQty = bBal?.available || 0;
    return bQty - aQty;
  });

  // Available stock at selected source bin
  const selectedSourceBal = balances.find(
    (b) => String(b.location?._id || b.location?.id || b.location) === String(sourceLocationId),
  );
  const availableAtSource = selectedSourceBal ? selectedSourceBal.available : 0;

  const mutation = useMutation({
    mutationFn: executeDirectBinTransfer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['replenishment-needs'] });
      queryClient.invalidateQueries({ queryKey: ['balances-direct-transfer'] });
      onClose();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to execute direct bin relocation',
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
    if (!effectiveProductId) {
      setFormError('Please select a product.');
      return;
    }
    if (!sourceLocationId) {
      setFormError('Please select a source bin.');
      return;
    }
    if (!destinationLocationId) {
      setFormError('Please select a destination bin.');
      return;
    }
    if (sourceLocationId === destinationLocationId) {
      setFormError('Source bin and destination bin must be distinct.');
      return;
    }
    const numQty = Number(quantity);
    if (!numQty || numQty <= 0) {
      setFormError('Transfer quantity must be greater than zero.');
      return;
    }
    if (selectedSourceBal && numQty > availableAtSource) {
      setFormError(
        `Quantity (${numQty}) exceeds available balance (${availableAtSource}) at source bin.`,
      );
      return;
    }

    mutation.mutate({
      warehouse: warehouseId,
      product: effectiveProductId,
      sourceLocation: sourceLocationId,
      destinationLocation: destinationLocationId,
      quantity: numQty,
      notes: notes.trim(),
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Warehouse
          </label>
          <Select
            value={warehouseId}
            onChange={(e) => {
              setSelectedWarehouseId(e.target.value);
              setSourceLocationId('');
              setDestinationLocationId('');
            }}
            options={warehouses.map((wh) => ({
              value: wh.id || wh._id,
              label: `${wh.code} - ${wh.name}`,
            }))}
            placeholder="Select warehouse..."
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Product
          </label>
          <Select
            value={effectiveProductId}
            onChange={(e) => {
              setProductId(e.target.value);
              setSourceLocationId('');
            }}
            options={products.map((p) => ({
              value: p.id || p._id,
              label: `${p.sku} - ${p.name}`,
            }))}
            placeholder="Select product..."
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Source Location (From)
            </label>
            {sourceLocationId && selectedSourceBal && (
              <span className="text-xs font-medium text-emerald-700">
                Avail: {availableAtSource}
              </span>
            )}
          </div>
          <Select
            value={sourceLocationId}
            onChange={(e) => setSourceLocationId(e.target.value)}
            options={sortedBins.map((loc) => {
              const locId = loc.id || loc._id;
              const bal = balances.find(
                (b) => String(b.location?._id || b.location?.id || b.location) === String(locId),
              );
              const balText = bal ? ` · [${bal.available} avail]` : '';
              const prefix = bal && bal.available > 0 ? '✓ ' : '';
              return {
                value: locId,
                label: `${prefix}${loc.code} (${loc.path || loc.purpose})${balText}`,
              };
            })}
            placeholder="Select source bin..."
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Destination Location (To)
          </label>
          <Select
            value={destinationLocationId}
            onChange={(e) => setDestinationLocationId(e.target.value)}
            options={sortedBins
              .filter((loc) => String(loc.id || loc._id) !== String(sourceLocationId))
              .map((loc) => ({
                value: loc.id || loc._id,
                label: `${loc.code} (${loc.path || loc.purpose})`,
              }))}
            placeholder="Select destination bin..."
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Quantity to Relocate
          </label>
          <Input
            type="number"
            min="0.001"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 50"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Operator Notes / Reason
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Bin consolidation / aisle reorganization"
          />
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
          <ArrowRightLeft className="w-4 h-4 mr-1.5" />
          Execute Relocation
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Direct Bin Relocation.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @param {object} [props.initialValues] - Pre-populated fields.
 * @returns {JSX.Element|null}
 */
export const DirectBinTransferModal = ({ isOpen, onClose, initialValues }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Direct Bin Relocation (Intra-Warehouse)"
      size="lg"
    >
      <DirectBinTransferForm onClose={onClose} initialValues={initialValues} />
    </Modal>
  );
};

export default DirectBinTransferModal;
