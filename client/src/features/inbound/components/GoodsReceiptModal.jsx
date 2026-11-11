/**
 * StockPilot WMS - Inbound Goods Receipt (GRN) Intake Modal.
 *
 * Implements physical dock receiving, batch/lot and serial capture,
 * QA inspection entry, and automated putaway task dispatching.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, ArrowDownToLine } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchSuppliers } from '@/features/suppliers/suppliersApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { fetchPurchaseOrders } from '@/features/purchasing/purchasingApi.js';
import { createGoodsReceipt } from '../inboundApi.js';
import { toMinorUnits, toMajorUnits } from '@/lib/money.js';

const createBlankLine = () => ({
  id: String(Date.now() + Math.random()),
  purchaseOrderItem: null,
  product: '',
  trackingType: 'NONE',
  receivedQty: 1,
  rejectedQty: 0,
  unitCost: 0,
  batchNumber: '',
  expiresOn: '',
  serialsRaw: '',
  condition: 'ACCEPTABLE',
});

/**
 * Inner Goods Receipt Form component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.prefillPo - Prefilled PO.
 * @param {Function} props.onClose - Modal close callback.
 * @returns {JSX.Element}
 */
const GoodsReceiptForm = ({ prefillPo, onClose }) => {
  const queryClient = useQueryClient();

  const [warehouseId, setWarehouseId] = useState(
    () => prefillPo?.warehouse?._id || prefillPo?.warehouse?.id || prefillPo?.warehouse || '',
  );
  const [supplierId, setSupplierId] = useState(
    () => prefillPo?.supplier?._id || prefillPo?.supplier?.id || prefillPo?.supplier || '',
  );
  const [purchaseOrderId, setPurchaseOrderId] = useState(
    () => prefillPo?._id || prefillPo?.id || '',
  );
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState(() => {
    if (prefillPo?.items?.length) {
      return prefillPo.items.map((line, idx) => {
        const remaining = Math.max(0, (line.orderedQty || 0) - (line.receivedQty || 0));
        const prodObj = line.product || {};
        const prodId = prodObj._id || prodObj.id || prodObj;
        return {
          id: String(idx + 1),
          purchaseOrderItem: line._id,
          product: prodId,
          trackingType: prodObj.trackingType || 'NONE',
          receivedQty: remaining > 0 ? remaining : line.orderedQty,
          rejectedQty: 0,
          unitCost: toMajorUnits(line.unitPriceMinor || 0),
          batchNumber: '',
          expiresOn: '',
          serialsRaw: '',
          condition: 'ACCEPTABLE',
        };
      });
    }
    return [createBlankLine()];
  });
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => fetchSuppliers({ limit: 100, isActive: 'true' }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list-all'],
    queryFn: () => fetchProducts({ limit: 100, isActive: 'true' }),
  });

  const { data: openOrdersData } = useQuery({
    queryKey: ['purchase-orders-open', { warehouse: warehouseId, supplier: supplierId }],
    queryFn: () =>
      fetchPurchaseOrders({
        warehouse: warehouseId || undefined,
        supplier: supplierId || undefined,
        status: 'CONFIRMED',
        limit: 50,
      }),
    enabled: Boolean(warehouseId || supplierId),
  });

  const warehouses = warehousesData?.items || [];
  const suppliers = suppliersData?.items || [];
  const products = productsData?.items || [];
  const openOrders = openOrdersData?.items || [];

  const handlePoSelectionChange = (poId) => {
    setPurchaseOrderId(poId);
    if (!poId) return;

    const po = openOrders.find((o) => (o.id || o._id) === poId);
    if (po) {
      if (!warehouseId) setWarehouseId(po.warehouse?._id || po.warehouse?.id || '');
      if (!supplierId) setSupplierId(po.supplier?._id || po.supplier?.id || '');

      const poLines = (po.items || []).map((line, idx) => {
        const remaining = Math.max(0, (line.orderedQty || 0) - (line.receivedQty || 0));
        const prodObj = line.product || {};
        const prodId = prodObj._id || prodObj.id || prodObj;
        return {
          id: String(idx + 1),
          purchaseOrderItem: line._id,
          product: prodId,
          trackingType: prodObj.trackingType || 'NONE',
          receivedQty: remaining > 0 ? remaining : line.orderedQty,
          rejectedQty: 0,
          unitCost: toMajorUnits(line.unitPriceMinor || 0),
          batchNumber: '',
          expiresOn: '',
          serialsRaw: '',
          condition: 'ACCEPTABLE',
        };
      });

      setItems(poLines.length > 0 ? poLines : [createBlankLine()]);
    }
  };

  const handleProductChange = (index, prodId) => {
    const selectedProd = products.find((p) => p.id === prodId || p._id === prodId);
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        product: prodId,
        trackingType: selectedProd?.trackingType || 'NONE',
        unitCost: selectedProd ? toMajorUnits(selectedProd.costPriceMinor || 0) : 0,
      };
      return next;
    });
  };

  const handleLineChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddLine = () => {
    setItems((prev) => [...prev, createBlankLine()]);
  };

  const handleRemoveLine = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const createMutation = useMutation({
    mutationFn: createGoodsReceipt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      onClose();
    },
    onError: (err) => {
      if (err?.details && Array.isArray(err.details) && err.details.length > 0) {
        const detailMsg = err.details
          .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
          .join(', ');
        setActionError(detailMsg);
      } else {
        setActionError(err?.message || 'Failed to record inbound goods receipt');
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    if (!warehouseId) {
      setActionError('Please select receiving warehouse');
      return;
    }
    if (!supplierId) {
      setActionError('Please select supplier');
      return;
    }

    const payloadItems = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.product) {
        setActionError(`Line ${i + 1}: Product must be selected`);
        return;
      }
      const recQty = Number(item.receivedQty) || 0;
      if (recQty <= 0) {
        setActionError(`Line ${i + 1}: Received quantity must be greater than zero`);
        return;
      }

      const linePayload = {
        purchaseOrderItem: item.purchaseOrderItem || undefined,
        product: item.product,
        receivedQty: recQty,
        rejectedQty: Number(item.rejectedQty) || 0,
        unitCostMinor: toMinorUnits(Number(item.unitCost) || 0),
        condition: item.condition || 'ACCEPTABLE',
      };

      if (item.trackingType === 'BATCH') {
        if (!item.batchNumber?.trim()) {
          setActionError(`Line ${i + 1}: Batch / Lot number is required for batch-tracked items`);
          return;
        }
        linePayload.batchNumber = item.batchNumber.trim();
        linePayload.expiresOn = item.expiresOn || undefined;
      }

      if (item.trackingType === 'SERIAL') {
        const serials = (item.serialsRaw || '')
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (serials.length !== recQty) {
          setActionError(
            `Line ${i + 1}: Serial-tracked product received quantity (${recQty}) does not match entered serial count (${serials.length})`,
          );
          return;
        }
        linePayload.serialNumbers = serials;
      }

      payloadItems.push(linePayload);
    }

    createMutation.mutate({
      warehouse: warehouseId,
      supplier: supplierId,
      purchaseOrder: purchaseOrderId || undefined,
      carrier: carrier.trim() || undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      items: payloadItems,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {actionError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          label="Warehouse Facility"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          required
        >
          <option value="">Select warehouse...</option>
          {warehouses.map((w) => (
            <option key={w.id || w._id} value={w.id || w._id}>
              {w.name} ({w.code})
            </option>
          ))}
        </Select>

        <Select
          label="Delivering Supplier"
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
          label="Linked Purchase Order"
          value={purchaseOrderId}
          onChange={(e) => handlePoSelectionChange(e.target.value)}
        >
          <option value="">Ad-Hoc / Direct Delivery</option>
          {openOrders.map((o) => (
            <option key={o.id || o._id} value={o.id || o._id}>
              {o.poNumber} ({o.status})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Logistics Carrier"
          placeholder="e.g. FedEx / DHL / FastTrack"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        />

        <Input
          label="Waybill / Tracking #"
          placeholder="e.g. TRK-982141"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />

        <Input
          label="Dock Receiving Notes"
          placeholder="e.g. Pallet 1 of 2 sealed"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Received Lines */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Received Line Items</h3>
            <p className="text-xs text-slate-500">
              Goods will be initially checked into the warehouse <strong>RECEIVING</strong> dock
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLine}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </Button>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {items.map((line, idx) => (
            <div
              key={line.id}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Product
                  </label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    value={line.product}
                    onChange={(e) => handleProductChange(idx, e.target.value)}
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.sku} - {p.name} ({p.trackingType})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Received Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    value={line.receivedQty}
                    onChange={(e) => handleLineChange(idx, 'receivedQty', e.target.value)}
                    required
                  />
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    value={line.rejectedQty}
                    onChange={(e) => handleLineChange(idx, 'rejectedQty', e.target.value)}
                  />
                </div>

                <div className="w-24">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Unit Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    value={line.unitCost}
                    onChange={(e) => handleLineChange(idx, 'unitCost', e.target.value)}
                  />
                </div>

                <div className="w-28">
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    QA Condition
                  </label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    value={line.condition}
                    onChange={(e) => handleLineChange(idx, 'condition', e.target.value)}
                  >
                    <option value="ACCEPTABLE">Acceptable</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="INCORRECT_ITEM">Incorrect Item</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    disabled={items.length <= 1}
                    className="rounded p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Batch Tracking Fields */}
              {line.trackingType === 'BATCH' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/70 p-2.5 rounded border border-amber-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">
                      Batch / Lot Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LOT-2026-001"
                      className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-600 font-mono"
                      value={line.batchNumber}
                      onChange={(e) => handleLineChange(idx, 'batchNumber', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-900 mb-0.5">
                      Expiration Date
                    </label>
                    <input
                      type="date"
                      className="w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                      value={line.expiresOn}
                      onChange={(e) => handleLineChange(idx, 'expiresOn', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Serial Tracking Fields */}
              {line.trackingType === 'SERIAL' && (
                <div className="bg-sky-50/70 p-2.5 rounded border border-sky-200">
                  <label className="block text-[11px] font-semibold text-sky-900 mb-0.5">
                    Serial Numbers ({Number(line.receivedQty) || 0} required, separated by commas or newlines) *
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. SN-001, SN-002, SN-003"
                    className="w-full rounded border border-sky-300 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-sky-600 font-mono"
                    value={line.serialsRaw}
                    onChange={(e) => handleLineChange(idx, 'serialsRaw', e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={createMutation.isPending}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Post Goods Receipt
        </Button>
      </div>
    </form>
  );
};

/**
 * Goods Receipt Modal wrapper component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Modal close callback.
 * @param {object|null} [props.prefillPo] - Optional prefilled purchase order.
 * @returns {JSX.Element}
 */
export const GoodsReceiptModal = ({ isOpen, onClose, prefillPo = null }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inbound Goods Receipt Note (GRN)"
      size="2xl"
    >
      <GoodsReceiptForm
        key={prefillPo ? (prefillPo._id || prefillPo.id) : 'empty'}
        prefillPo={prefillPo}
        onClose={onClose}
      />
    </Modal>
  );
};

export default GoodsReceiptModal;
