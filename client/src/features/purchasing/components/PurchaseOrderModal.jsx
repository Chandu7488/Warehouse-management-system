/**
 * StockPilot WMS - Purchase Order Builder Modal.
 *
 * Provides multi-line purchase order authoring with real-time pricing computations,
 * supplier selection, and catalog product lookups.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchSuppliers } from '@/features/suppliers/suppliersApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { createPurchaseOrder } from '../purchasingApi.js';
import { toMinorUnits, toMajorUnits, formatMoney } from '@/lib/money.js';

/**
 * Purchase Order Creation Modal component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is displayed.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
export const PurchaseOrderModal = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { id: '1', product: '', orderedQty: 1, unitPrice: 0 },
  ]);
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
    enabled: isOpen,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => fetchSuppliers({ limit: 100, isActive: 'true' }),
    enabled: isOpen,
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list-all'],
    queryFn: () => fetchProducts({ limit: 100, isActive: 'true' }),
    enabled: isOpen,
  });

  const warehouses = warehousesData?.items || [];
  const suppliers = suppliersData?.items || [];
  const products = productsData?.items || [];

  const handleAddLine = () => {
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), product: '', orderedQty: 1, unitPrice: 0 },
    ]);
  };

  const handleRemoveLine = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index, prodId) => {
    const selectedProd = products.find((p) => p.id === prodId || p._id === prodId);
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        product: prodId,
        unitPrice: selectedProd ? toMajorUnits(selectedProd.costPriceMinor || 0) : 0,
      };
      return next;
    });
  };

  const handleQtyChange = (index, qty) => {
    const num = Math.max(1, Number(qty) || 1);
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], orderedQty: num };
      return next;
    });
  };

  const handlePriceChange = (index, price) => {
    const num = Math.max(0, Number(price) || 0);
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unitPrice: num };
      return next;
    });
  };

  const totalAmountMinor = items.reduce((acc, item) => {
    return acc + Math.round((Number(item.orderedQty) || 0) * toMinorUnits(Number(item.unitPrice) || 0));
  }, 0);

  const totalUnits = items.reduce((acc, item) => acc + (Number(item.orderedQty) || 0), 0);

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      handleReset();
      onClose();
    },
    onError: (err) => {
      if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
        const detailMsg = err.details
          .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
          .join(', ');
        setActionError(detailMsg);
      } else {
        setActionError(err?.message || 'Failed to create purchase order');
      }
    },
  });

  const handleReset = () => {
    setWarehouseId('');
    setSupplierId('');
    setExpectedDate('');
    setNotes('');
    setItems([{ id: '1', product: '', orderedQty: 1, unitPrice: 0 }]);
    setActionError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    if (!warehouseId) {
      setActionError('Please select a destination warehouse facility');
      return;
    }
    if (!supplierId) {
      setActionError('Please select an active supplier');
      return;
    }
    if (items.some((item) => !item.product)) {
      setActionError('Please select a catalog product for all order lines');
      return;
    }
    if (items.some((item) => item.orderedQty <= 0)) {
      setActionError('Order quantities must be greater than zero');
      return;
    }

    createMutation.mutate({
      warehouse: warehouseId,
      supplier: supplierId,
      expectedDeliveryDate: expectedDate || null,
      notes,
      items: items.map((i) => ({
        product: i.product,
        orderedQty: Number(i.orderedQty),
        unitPriceMinor: toMinorUnits(Number(i.unitPrice)),
      })),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Create Purchase Order"
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {actionError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
          >
            <option value="">Select supplier...</option>
            {suppliers.map((s) => (
              <option key={s.id || s._id} value={s.id || s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </Select>

          <Select
            label="Destination Warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            required
          >
            <option value="">Select facility...</option>
            {warehouses.map((w) => (
              <option key={w.id || w._id} value={w.id || w._id}>
                {w.name} ({w.code})
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="date"
            label="Expected Delivery Date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />

          <Input
            label="Notes / PO Reference"
            placeholder="e.g. Q2 restock batch"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* PO Line Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-sm font-semibold text-slate-800">Order Line Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Product Line
            </Button>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {items.map((line, idx) => (
              <div
                key={line.id}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    value={line.product}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-start">
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                      value={line.orderedQty}
                      onChange={(e) => handleQtyChange(idx, e.target.value)}
                      required
                    />
                  </div>

                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price ($)"
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                      value={line.unitPrice}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      required
                    />
                  </div>

                  <div className="w-24 text-right font-semibold text-slate-800 text-xs shrink-0">
                    {formatMoney(
                      Math.round(
                        (Number(line.orderedQty) || 0) * toMinorUnits(Number(line.unitPrice) || 0),
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={items.length <= 1}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center rounded-lg bg-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Total Lines: <strong className="text-slate-900">{items.length}</strong> &middot; Total Units:{' '}
              <strong className="text-slate-900">{totalUnits}</strong>
            </span>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wider text-slate-500 mr-2">PO Total:</span>
              <span className="text-base font-bold text-indigo-700">
                {formatMoney(totalAmountMinor)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleReset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Create Draft Order
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PurchaseOrderModal;
