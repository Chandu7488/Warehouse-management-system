/**
 * StockPilot WMS - Create Stock Adjustment Modal.
 *
 * Configures direct inventory write-offs, scrap records, and manual adjustments
 * with live balance validation and justification logging.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, SlidersHorizontal } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { fetchBalances } from '@/features/inventory/inventoryApi.js';
import { createAdjustment } from '../adjustmentsApi.js';

const createBlankLine = () => ({
  id: String(Date.now() + Math.random()),
  product: '',
  location: '',
  quantity: -1,
  reason: 'Damaged during handling',
});

/**
 * Inner form for creating a Stock Adjustment.
 *
 * @param {object} props
 * @param {Function} props.onClose
 * @returns {JSX.Element}
 */
const CreateAdjustmentForm = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('WRITE_OFF');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([createBlankLine()]);
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
    queryKey: ['locations-for-adj', activeWarehouseId],
    queryFn: () => fetchLocations({ warehouse: activeWarehouseId, limit: 100 }),
    enabled: Boolean(activeWarehouseId),
  });
  const locations = locationsData?.items || [];

  const { data: productsData } = useQuery({
    queryKey: ['products-for-adj'],
    queryFn: () => fetchProducts({ limit: 100 }),
  });
  const products = productsData?.items || [];

  // Live balances query for warehouse
  const { data: balancesData } = useQuery({
    queryKey: ['balances-for-adj', activeWarehouseId],
    queryFn: () => fetchBalances({ warehouse: activeWarehouseId, limit: 200 }),
    enabled: Boolean(activeWarehouseId),
  });
  const balances = balancesData?.items || [];

  const getAvailableOnHand = (productId, locationId) => {
    if (!productId || !locationId) return null;
    const match = balances.find(
      (b) =>
        String(b.product?.id || b.product?._id || b.product) === String(productId) &&
        String(b.location?.id || b.location?._id || b.location) === String(locationId),
    );
    return match ? match.onHand : 0;
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      if (field === 'product' && value) {
        const inStockBal = balances.find(
          (b) =>
            String(b.product?.id || b.product?._id || b.product) === String(value) &&
            (b.onHand || 0) > 0,
        );
        if (inStockBal) {
          const locId =
            inStockBal.location?.id || inStockBal.location?._id || inStockBal.location;
          if (locId) {
            copy[index].location = String(locId);
          }
        }
      }
      return copy;
    });
  };

  const handleAddLine = () => {
    setItems((prev) => [...prev, createBlankLine()]);
  };

  const handleRemoveLine = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: () => {
      if (!reason.trim()) {
        throw new Error('Overall adjustment reason is required');
      }

      const validatedItems = items.map((it) => {
        if (!it.product) throw new Error('Each line must specify a product');
        if (!it.location) throw new Error('Each line must specify a location');
        const qty = Number(it.quantity);
        if (Number.isNaN(qty) || qty === 0) {
          throw new Error('Quantity cannot be zero');
        }
        if (!it.reason.trim()) {
          throw new Error('Each item requires a justification reason');
        }
        return {
          product: it.product,
          location: it.location,
          quantity: qty,
          reason: it.reason.trim(),
        };
      });

      return createAdjustment({
        warehouse: activeWarehouseId,
        type,
        reason: reason.trim(),
        notes: notes.trim(),
        items: validatedItems,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });
      onClose();
    },
    onError: (err) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to create adjustment proposal');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    createMutation.mutate();
  };

  const netQty = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

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
            Target Warehouse *
          </label>
          <Select
            value={activeWarehouseId}
            onChange={(e) => {
              setWarehouseId(e.target.value);
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
            Adjustment Classification *
          </label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="WRITE_OFF">Stock Write-Off (Damaged / Expired / Lost)</option>
            <option value="DAMAGED_SCRAP">Damaged Scrap</option>
            <option value="FOUND_STOCK">Found Stock / Inventory Surplus</option>
            <option value="MANUAL_ADJUSTMENT">Manual Discrepancy Adjustment</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Primary Adjustment Reason *
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Scrapping crushed cartons from Bay 4 drop"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reference / Memo (Optional)
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Incident report #IR-2026-88"
          />
        </div>
      </div>

      {/* Dynamic Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-slate-800">
            Adjustment Items &amp; Bin Locations
          </label>
          <span className="text-xs text-slate-500">
            Net Change: <span className={netQty < 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>{netQty > 0 ? `+${netQty}` : netQty} units</span>
          </span>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const onHand = getAvailableOnHand(item.product, item.location);

            return (
              <div
                key={item.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Product *
                    </label>
                    <Select
                      value={item.product}
                      onChange={(e) => handleItemChange(index, 'product', e.target.value)}
                    >
                      <option value="">Select product...</option>
                      {products.map((p) => {
                        const id = p.id || p._id;
                        const prodOnHand = balances
                          .filter(
                            (b) =>
                              String(b.product?.id || b.product?._id || b.product) ===
                              String(id),
                          )
                          .reduce((sum, b) => sum + (b.onHand || 0), 0);
                        return (
                          <option key={id} value={id}>
                            {p.sku} - {p.name} {prodOnHand > 0 ? `(${prodOnHand} in stock)` : ''}
                          </option>
                        );
                      })}
                    </Select>
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Location / Bin *
                    </label>
                    <Select
                      value={item.location}
                      onChange={(e) => handleItemChange(index, 'location', e.target.value)}
                    >
                      <option value="">Select bin...</option>
                      {locations.map((loc) => {
                        const id = loc.id || loc._id;
                        const binBal = getAvailableOnHand(item.product, id);
                        return (
                          <option key={id} value={id}>
                            {loc.code} ({loc.type}) {binBal > 0 ? ` · [${binBal} on-hand]` : ''}
                          </option>
                        );
                      })}
                    </Select>
                    {onHand !== null && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Current on-hand: <span className="font-semibold text-slate-700">{onHand} units</span>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Adjustment Qty * (e.g. -5 or +5)
                    </label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      placeholder="-1"
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-end pt-5">
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleRemoveLine(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Input
                    size="sm"
                    placeholder="Specific item defect / discrepancy reason..."
                    value={item.reason}
                    onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={Plus}
          onClick={handleAddLine}
        >
          Add Another Item Line
        </Button>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={createMutation.isPending}
          icon={SlidersHorizontal}
        >
          Submit Adjustment Proposal
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Stock Adjustment Creation.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @returns {JSX.Element|null}
 */
export const CreateAdjustmentModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Stock Adjustment / Write-Off"
      description="Propose direct inventory adjustments, scrap deductions, or surplus captures with full audit justification."
      size="xl"
    >
      <CreateAdjustmentForm onClose={onClose} />
    </Modal>
  );
};

export default CreateAdjustmentModal;
