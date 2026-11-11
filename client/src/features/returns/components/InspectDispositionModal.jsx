/**
 * StockPilot WMS - Quality Inspection & Ledger Disposition Modal.
 *
 * Implements QA grading, condition classification, and atomic stock ledger
 * routing into active sellable storage bins, quarantine zones, or scrap write-off.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { processDisposition } from '../returnsApi.js';

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Brand New (Factory Sealed)' },
  { value: 'LIKE_NEW', label: 'Like New (Packaging Opened)' },
  { value: 'DAMAGED', label: 'Physically Damaged' },
  { value: 'DEFECTIVE', label: 'Defective / Faulty Electronics' },
  { value: 'EXPIRED', label: 'Expired Shelf Life' },
];

/**
 * Inner disposition form component.
 *
 * @param {object} props - Component properties.
 * @param {object} props.rma - RMA document.
 * @param {Function} props.onClose - Dismiss callback.
 * @returns {JSX.Element}
 */
const InspectDispositionForm = ({ rma, onClose }) => {
  const queryClient = useQueryClient();
  const warehouseId = rma.warehouse?._id || rma.warehouse?.id || rma.warehouse;
  const isCustomer = rma.returnType === 'CUSTOMER_RETURN';

  const { data: locationsData } = useQuery({
    queryKey: ['locations-disposition', warehouseId],
    queryFn: () => fetchLocations({ warehouse: warehouseId, limit: 100 }),
    enabled: Boolean(warehouseId),
  });

  const locations = locationsData?.items || [];
  const storageBins = locations.filter(
    (loc) => loc.purpose === 'STORAGE' || loc.purpose === 'PICKING' || loc.type === 'BIN',
  );
  const quarantineBins = locations.filter(
    (loc) => loc.purpose === 'QUARANTINE' || loc.type === 'BIN',
  );

  const initialItems = (rma.items || []).map((line) => ({
    itemId: line._id || line.id,
    product: line.product,
    expectedQty: line.expectedQty,
    receivedQty: line.receivedQty || line.expectedQty,
    inspectedQty: line.receivedQty || line.expectedQty,
    condition: line.condition || 'NEW',
    disposition: isCustomer ? 'RESTOCK' : 'RETURN_TO_VENDOR',
    targetLocationId: isCustomer ? storageBins[0]?.id || storageBins[0]?._id || '' : '',
    notes: '',
  }));

  const [items, setItems] = useState(initialItems);
  const [actionError, setActionError] = useState(null);

  const dispositionMutation = useMutation({
    mutationFn: (payload) => processDisposition(rma._id || rma.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      onClose();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to commit disposition',
      );
    },
  });

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    for (const [idx, item] of items.entries()) {
      if (
        (item.disposition === 'RESTOCK' ||
          item.disposition === 'QUARANTINE' ||
          item.disposition === 'RETURN_TO_VENDOR') &&
        !item.targetLocationId
      ) {
        setActionError(
          `Line ${idx + 1}: Please select a valid bin location for disposition ${item.disposition}`,
        );
        return;
      }
    }

    dispositionMutation.mutate({
      items: items.map((it) => ({
        itemId: it.itemId,
        disposition: it.disposition,
        condition: it.condition,
        targetLocationId: it.targetLocationId || undefined,
        inspectedQty: Number(it.inspectedQty),
        notes: it.notes.trim() || undefined,
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

      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {items.map((line, idx) => (
          <div
            key={line.itemId || idx}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="font-semibold text-sm text-slate-900">
                  {line.product?.name || 'Returned Product'}
                </span>
                <span className="ml-2 font-mono text-xs text-slate-500">
                  ({line.product?.sku})
                </span>
              </div>
              <div className="text-xs text-slate-600 font-medium">
                Received: <strong className="text-indigo-700">{line.receivedQty}</strong> units
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="QA Condition Grade"
                value={line.condition}
                onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                options={CONDITION_OPTIONS}
              />

              <Select
                label="Disposition Decision"
                value={line.disposition}
                onChange={(e) => {
                  const disp = e.target.value;
                  let target = line.targetLocationId;
                  if (disp === 'QUARANTINE') {
                    target = quarantineBins[0]?.id || quarantineBins[0]?._id || '';
                  } else if (disp === 'RESTOCK' || disp === 'RETURN_TO_VENDOR') {
                    target = storageBins[0]?.id || storageBins[0]?._id || '';
                  }
                  handleItemChange(idx, 'disposition', disp);
                  handleItemChange(idx, 'targetLocationId', target);
                }}
                options={
                  isCustomer
                    ? [
                        { value: 'RESTOCK', label: 'Restock into Sellable Storage' },
                        { value: 'QUARANTINE', label: 'Quarantine Holding Zone' },
                        { value: 'SCRAP', label: 'Scrap / Unsalvageable Write-off' },
                      ]
                    : [
                        { value: 'RETURN_TO_VENDOR', label: 'Return to Vendor (Credit)' },
                        { value: 'QUARANTINE', label: 'Quarantine Holding Zone' },
                      ]
                }
              />

              <Input
                label="Inspected Quantity"
                type="number"
                min="0.01"
                step="any"
                max={line.receivedQty}
                value={line.inspectedQty}
                onChange={(e) => handleItemChange(idx, 'inspectedQty', e.target.value)}
                required
              />
            </div>

            {(line.disposition === 'RESTOCK' ||
              line.disposition === 'QUARANTINE' ||
              line.disposition === 'RETURN_TO_VENDOR') && (
              <div>
                <Select
                  label={
                    line.disposition === 'RETURN_TO_VENDOR'
                      ? 'Source Bin Location (Deduct stock from)'
                      : line.disposition === 'QUARANTINE'
                      ? 'Quarantine Bin Location'
                      : 'Destination Storage Bin (Restock into)'
                  }
                  value={line.targetLocationId}
                  onChange={(e) => handleItemChange(idx, 'targetLocationId', e.target.value)}
                  required
                  options={[
                    { value: '', label: '-- Select Bin Location --' },
                    ...(line.disposition === 'QUARANTINE' ? quarantineBins : storageBins).map(
                      (loc) => ({
                        value: loc.id || loc._id,
                        label: `${loc.path || loc.code} (${loc.purpose || loc.type})`,
                      }),
                    ),
                  ]}
                />
              </div>
            )}

            <Input
              label="QA Inspector Notes"
              value={line.notes}
              onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
              placeholder="e.g. Tested full power-on cycle; no functional defects found."
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-900 flex items-start gap-2">
        <ClipboardCheck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <span>
          Committing this disposition will post an immutable transaction to the Stock Ledger (
          <strong className="font-mono">{isCustomer ? 'CUSTOMER_RETURN' : 'SUPPLIER_RETURN'}</strong>
          ) and update inventory balances accordingly.
        </span>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          size="sm"
          type="submit"
          isLoading={dispositionMutation.isPending}
        >
          <ClipboardCheck className="h-4 w-4 mr-1.5" />
          Commit Quality Inspection &amp; Post Ledger
        </Button>
      </div>
    </form>
  );
};

/**
 * Inspection & Disposition Modal wrapper.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object|null} props.rma - RMA document.
 * @returns {JSX.Element|null}
 */
export const InspectDispositionModal = ({ isOpen, onClose, rma }) => {
  if (!isOpen || !rma) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Quality Inspection & Disposition: ${rma.rmaNumber}`}
      size="2xl"
    >
      <InspectDispositionForm rma={rma} onClose={onClose} />
    </Modal>
  );
};

export default InspectDispositionModal;
