/**
 * StockPilot WMS - Return Merchandise Authorization (RMA) Creation Modal.
 *
 * Implements customer return and vendor RMA creation, line item condition capture,
 * and commercial reference linking.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle, RotateCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchCustomers } from '@/features/customers/customersApi.js';
import { fetchSuppliers } from '@/features/suppliers/suppliersApi.js';
import { fetchProducts } from '@/features/products/productsApi.js';
import { createReturnOrder } from '../returnsApi.js';

const REASON_OPTIONS = [
  { value: 'DEFECTIVE_PRODUCT', label: 'Defective / Faulty Hardware' },
  { value: 'WRONG_ITEM_SENT', label: 'Wrong Item Shipped' },
  { value: 'CUSTOMER_CHANGED_MIND', label: 'Customer Changed Mind / Refund' },
  { value: 'TRANSIT_DAMAGE', label: 'Damaged in Courier Transit' },
  { value: 'SUPPLIER_RECALL', label: 'Manufacturer / Supplier Recall' },
  { value: 'OVERSTOCK', label: 'Excess / Surplus Overstock' },
  { value: 'OTHER', label: 'Other Reason' },
];

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Brand New (Factory Sealed)' },
  { value: 'LIKE_NEW', label: 'Like New (Open Box)' },
  { value: 'DAMAGED', label: 'Physically Damaged' },
  { value: 'DEFECTIVE', label: 'Defective / Inoperable' },
  { value: 'EXPIRED', label: 'Expired Shelf Life' },
];

const createBlankLine = () => ({
  id: String(Date.now() + Math.random()),
  product: '',
  expectedQty: 1,
  condition: 'NEW',
  reason: 'DEFECTIVE_PRODUCT',
  reasonNotes: '',
});

/**
 * Inner form for RMA creation.
 *
 * @param {object} props - Component properties.
 * @param {Function} props.onClose - Modal dismissal callback.
 * @returns {JSX.Element}
 */
const CreateReturnForm = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [returnType, setReturnType] = useState('CUSTOMER_RETURN');
  const [warehouseId, setWarehouseId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([createBlankLine()]);
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => fetchCustomers({ limit: 100, isActive: 'true' }),
    enabled: returnType === 'CUSTOMER_RETURN',
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => fetchSuppliers({ limit: 100, isActive: 'true' }),
    enabled: returnType === 'SUPPLIER_RETURN',
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-list-all'],
    queryFn: () => fetchProducts({ limit: 100, isActive: 'true' }),
  });

  const warehouses = warehousesData?.items || [];
  const customers = customersData?.items || [];
  const suppliers = suppliersData?.items || [];
  const products = productsData?.items || [];

  const createMutation = useMutation({
    mutationFn: (payload) => createReturnOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-orders'] });
      onClose();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to create return order',
      );
    },
  });

  const handleAddLine = () => {
    setItems((prev) => [...prev, createBlankLine()]);
  };

  const handleRemoveLine = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    if (!warehouseId) {
      setActionError('Please select a target warehouse');
      return;
    }

    if (returnType === 'CUSTOMER_RETURN' && !customerId) {
      setActionError('Customer returns require selecting a customer');
      return;
    }

    if (returnType === 'SUPPLIER_RETURN' && !supplierId) {
      setActionError('Supplier returns require selecting a supplier');
      return;
    }

    for (const [idx, line] of items.entries()) {
      if (!line.product) {
        setActionError(`Line ${idx + 1}: Please select a product`);
        return;
      }
      if (!line.expectedQty || Number(line.expectedQty) <= 0) {
        setActionError(`Line ${idx + 1}: Expected quantity must be greater than zero`);
        return;
      }
    }

    createMutation.mutate({
      returnType,
      warehouse: warehouseId,
      customer: returnType === 'CUSTOMER_RETURN' ? customerId : undefined,
      supplier: returnType === 'SUPPLIER_RETURN' ? supplierId : undefined,
      trackingNumber: trackingNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      items: items.map((line) => ({
        product: line.product,
        expectedQty: Number(line.expectedQty),
        condition: line.condition,
        reason: line.reason,
        reasonNotes: line.reasonNotes.trim() || undefined,
      })),
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

      {/* Return Type Selector */}
      <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-100 max-w-md">
        <button
          type="button"
          onClick={() => {
            setReturnType('CUSTOMER_RETURN');
            setSupplierId('');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
            returnType === 'CUSTOMER_RETURN'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Return (RMA)
        </button>
        <button
          type="button"
          onClick={() => {
            setReturnType('SUPPLIER_RETURN');
            setCustomerId('');
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
            returnType === 'SUPPLIER_RETURN'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Supplier Return (Vendor Claim)
        </button>
      </div>

      {/* Facility & Trading Partner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Warehouse Facility"
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          required
          options={[
            { value: '', label: '-- Select Warehouse --' },
            ...warehouses.map((w) => ({
              value: w.id || w._id,
              label: `${w.name} (${w.code})`,
            })),
          ]}
        />

        {returnType === 'CUSTOMER_RETURN' ? (
          <Select
            label="Customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            options={[
              { value: '', label: '-- Select Customer --' },
              ...customers.map((c) => ({
                value: c.id || c._id,
                label: `${c.name} (${c.code})`,
              })),
            ]}
          />
        ) : (
          <Select
            label="Supplier / Vendor"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            required
            options={[
              { value: '', label: '-- Select Supplier --' },
              ...suppliers.map((s) => ({
                value: s.id || s._id,
                label: `${s.name} (${s.code})`,
              })),
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Tracking / Inbound Waybill #"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="e.g. RET-FEDEX-998811"
        />

        <Input
          label="Internal Notes / Customer Ticket #"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Zendesk ticket #4492 - packaging crushed"
        />
      </div>

      {/* Line Items Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Returned Items ({items.length})
          </label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddLine}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Item
          </Button>
        </div>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {items.map((line, idx) => (
            <div
              key={line.id || idx}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <Select
                    label={`Item ${idx + 1}: Product`}
                    value={line.product}
                    onChange={(e) => handleLineChange(idx, 'product', e.target.value)}
                    required
                    options={[
                      { value: '', label: '-- Select Product --' },
                      ...products.map((p) => ({
                        value: p.id || p._id,
                        label: `${p.name} (${p.sku})`,
                      })),
                    ]}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Expected Qty"
                    type="number"
                    min="1"
                    step="1"
                    value={line.expectedQty}
                    onChange={(e) => handleLineChange(idx, 'expectedQty', e.target.value)}
                    required
                  />
                </div>

                <div className="sm:col-span-4">
                  <Select
                    label="Return Reason"
                    value={line.reason}
                    onChange={(e) => handleLineChange(idx, 'reason', e.target.value)}
                    options={REASON_OPTIONS}
                  />
                </div>

                <div className="sm:col-span-1 flex justify-end pb-2">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Initial Condition Assessment"
                  value={line.condition}
                  onChange={(e) => handleLineChange(idx, 'condition', e.target.value)}
                  options={CONDITION_OPTIONS}
                />

                <Input
                  label="Reason Notes / Damage Description"
                  value={line.reasonNotes}
                  onChange={(e) => handleLineChange(idx, 'reasonNotes', e.target.value)}
                  placeholder="e.g. Scratched front bezel, power cord missing"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={createMutation.isPending}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Authorize RMA
        </Button>
      </div>
    </form>
  );
};

/**
 * Return Order Modal wrapper component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Modal dismissal callback.
 * @returns {JSX.Element|null}
 */
export const CreateReturnModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Return Order (RMA)"
      size="2xl"
    >
      <CreateReturnForm onClose={onClose} />
    </Modal>
  );
};

export default CreateReturnModal;
