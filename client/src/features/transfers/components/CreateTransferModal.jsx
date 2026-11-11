/**
 * StockPilot WMS - Inter-Warehouse Transfer Order Creation Modal.
 *
 * Configures facility-to-facility transit shipments with origin source bins
 * and requested quantities.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, Truck } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { fetchBalances } from '@/features/inventory/inventoryApi.js';
import { createTransferOrder } from '../transfersApi.js';

const createBlankLine = () => ({
  id: String(Date.now() + Math.random()),
  product: '',
  requestedQty: 1,
  sourceLocation: '',
});

/**
 * Inner form for creating a Transfer Order.
 *
 * @param {object} props - Component properties.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
const CreateTransferForm = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [userOriginId, setUserOriginId] = useState('');
  const [userDestId, setUserDestId] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([createBlankLine()]);
  const [formError, setFormError] = useState('');

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];

  const originWarehouseId =
    userOriginId ||
    warehouses.find((w) => w.code === 'WH-MAIN')?.id ||
    warehouses[0]?.id ||
    warehouses[0]?._id ||
    '';
  const destinationWarehouseId =
    userDestId ||
    warehouses.find((w) => (w.id || w._id) !== originWarehouseId)?.id ||
    warehouses.find((w) => (w.id || w._id) !== originWarehouseId)?._id ||
    '';

  // Fetch products (limit capped at 100)
  const { data: productsData } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });
  const products = productsData?.items || [];

  // Fetch origin warehouse locations for source bin selection (limit capped at 100)
  const { data: originLocationsData } = useQuery({
    queryKey: ['locations-origin', originWarehouseId],
    queryFn: () => fetchLocations({ warehouse: originWarehouseId, limit: 100 }),
    enabled: Boolean(originWarehouseId),
  });
  const originLocations = originLocationsData?.items || [];
  const binsOnly = originLocations.filter((loc) => loc.type === 'BIN');
  const selectableOriginBins = binsOnly.length > 0 ? binsOnly : originLocations;

  // Fetch origin warehouse stock balances (to display available quantities in bin dropdowns)
  const { data: balancesData } = useQuery({
    queryKey: ['balances-origin', originWarehouseId],
    queryFn: () => fetchBalances({ warehouse: originWarehouseId, limit: 100 }),
    enabled: Boolean(originWarehouseId),
  });
  const balances = balancesData?.items || [];

  const handleAddItem = () => {
    setItems((prev) => [...prev, createBlankLine()]);
  };

  const handleRemoveItem = (id) => {
    if (items.length === 1) {
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'product' && value) {
          const matchingBal = balances.find(
            (b) =>
              String(b.product?.id || b.product?._id || b.product) === String(value) &&
              (b.available || 0) > 0,
          );
          if (matchingBal) {
            updated.sourceLocation = matchingBal.location?.id || matchingBal.location?._id || '';
          }
        }
        return updated;
      }),
    );
  };

  const getBinOptionsForProduct = (prodId) => {
    const prodBalances = balances.filter(
      (b) => String(b.product?.id || b.product?._id || b.product) === String(prodId),
    );

    const sorted = [...selectableOriginBins].sort((a, b) => {
      const aId = String(a.id || a._id);
      const bId = String(b.id || b._id);
      const aBal = prodBalances.find(
        (bal) => String(bal.location?.id || bal.location?._id || bal.location) === aId,
      );
      const bBal = prodBalances.find(
        (bal) => String(bal.location?.id || bal.location?._id || bal.location) === bId,
      );
      return (bBal?.available || 0) - (aBal?.available || 0);
    });

    return sorted.map((loc) => {
      const locId = loc.id || loc._id;
      const bal = prodBalances.find(
        (b) => String(b.location?.id || b.location?._id || b.location) === String(locId),
      );
      const balText = bal && bal.available > 0 ? ` · [${bal.available} avail]` : '';
      const prefix = bal && bal.available > 0 ? '✓ ' : '';
      return {
        value: locId,
        label: `${prefix}${loc.code} (${loc.path || loc.purpose})${balText}`,
      };
    });
  };

  const mutation = useMutation({
    mutationFn: createTransferOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
      onClose();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to create transfer order',
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!originWarehouseId) {
      setFormError('Please select an origin warehouse.');
      return;
    }
    if (!destinationWarehouseId) {
      setFormError('Please select a destination warehouse.');
      return;
    }
    if (originWarehouseId === destinationWarehouseId) {
      setFormError('Origin and destination warehouses must be different facilities.');
      return;
    }

    if (items.length === 0) {
      setFormError('At least one item line is required.');
      return;
    }

    for (let i = 0; i < items.length; i += 1) {
      const line = items[i];
      if (!line.product) {
        setFormError(`Item #${i + 1}: Please select a product.`);
        return;
      }
      if (!line.sourceLocation) {
        setFormError(`Item #${i + 1}: Please select an origin source bin.`);
        return;
      }
      const qty = Number(line.requestedQty);
      if (!qty || qty <= 0) {
        setFormError(`Item #${i + 1}: Quantity must be greater than zero.`);
        return;
      }
    }

    mutation.mutate({
      transferType: 'INTER_WAREHOUSE',
      originWarehouse: originWarehouseId,
      destinationWarehouse: destinationWarehouseId,
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
      notes: notes.trim(),
      items: items.map((item) => ({
        product: item.product,
        requestedQty: Number(item.requestedQty),
        sourceLocation: item.sourceLocation,
      })),
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
            Origin Warehouse (Dispatch From)
          </label>
          <Select
            value={originWarehouseId}
            onChange={(e) => {
              setUserOriginId(e.target.value);
              setItems((prev) => prev.map((l) => ({ ...l, sourceLocation: '' })));
            }}
            options={warehouses.map((wh) => ({
              value: wh.id || wh._id,
              label: `${wh.code} - ${wh.name}`,
            }))}
            placeholder="Select origin facility..."
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Destination Warehouse (Receive At)
          </label>
          <Select
            value={destinationWarehouseId}
            onChange={(e) => setUserDestId(e.target.value)}
            options={warehouses
              .filter((wh) => (wh.id || wh._id) !== originWarehouseId)
              .map((wh) => ({
                value: wh.id || wh._id,
                label: `${wh.code} - ${wh.name}`,
              }))}
            placeholder="Select destination facility..."
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Freight Carrier / Transporter
          </label>
          <Input
            type="text"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. FedEx Freight / Internal Shuttle"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Tracking / Waybill Number
          </label>
          <Input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. TRK-987654321"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Transfer Notes & Instructions
        </label>
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Urgent stock rebalancing for peak sales campaign"
        />
      </div>

      {/* Transfer Items Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Transfer Line Items ({items.length})
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Line
          </Button>
        </div>

        <div className="p-3 space-y-3 max-h-72 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm"
            >
              <div className="md:col-span-5">
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                  Product #{idx + 1}
                </label>
                <Select
                  value={item.product}
                  onChange={(e) => handleUpdateItem(item.id, 'product', e.target.value)}
                  options={products.map((p) => ({
                    value: p.id || p._id,
                    label: `${p.sku} - ${p.name}`,
                  }))}
                  placeholder="Select product..."
                  required
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                  Origin Source Bin
                </label>
                <Select
                  value={item.sourceLocation}
                  onChange={(e) => handleUpdateItem(item.id, 'sourceLocation', e.target.value)}
                  options={getBinOptionsForProduct(item.product)}
                  placeholder="Select source bin..."
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={item.requestedQty}
                  onChange={(e) => handleUpdateItem(item.id, 'requestedQty', e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-1 flex justify-center pt-4 md:pt-0">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={items.length === 1}
                  className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
          <Truck className="w-4 h-4 mr-1.5" />
          Create Transfer Order
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Transfer Order Creation.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @returns {JSX.Element|null}
 */
export const CreateTransferModal = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Inter-Warehouse Transfer Order"
      size="xl"
    >
      <CreateTransferForm onClose={onClose} />
    </Modal>
  );
};

export default CreateTransferModal;
