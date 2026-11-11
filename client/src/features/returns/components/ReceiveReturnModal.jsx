/**
 * StockPilot WMS - Return Order Dock Intake Modal.
 *
 * Allows warehouse receiving staff to record physical delivery and intake
 * of returned packages at the returns dock.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import { receiveReturnOrder } from '../returnsApi.js';

/**
 * Inner dock receiving form component.
 *
 * @param {object} props - Component properties.
 * @param {object} props.rma - RMA document.
 * @param {Function} props.onClose - Dismiss callback.
 * @returns {JSX.Element}
 */
const ReceiveReturnForm = ({ rma, onClose }) => {
  const queryClient = useQueryClient();

  const [items, setItems] = useState(
    (rma.items || []).map((line) => ({
      itemId: line._id || line.id,
      product: line.product,
      expectedQty: line.expectedQty,
      receivedQty: line.expectedQty,
    })),
  );
  const [actionError, setActionError] = useState(null);

  const receiveMutation = useMutation({
    mutationFn: (payload) => receiveReturnOrder(rma._id || rma.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-orders'] });
      onClose();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to record dock receipt',
      );
    },
  });

  const handleQtyChange = (index, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], receivedQty: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    receiveMutation.mutate({
      items: items.map((it) => ({
        itemId: it.itemId,
        receivedQty: Number(it.receivedQty) || 0,
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

      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700">RMA Number:</span>
          <span className="font-mono font-bold text-slate-900">{rma.rmaNumber}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-700">Tracking / Waybill:</span>
          <span className="font-mono text-indigo-700">
            {rma.trackingNumber || 'Unspecified'}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
          Verify Quantities Received at Returns Dock
        </label>
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {items.map((line, idx) => (
            <div
              key={line.itemId || idx}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-white"
            >
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  {line.product?.name || 'Item'}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {line.product?.sku} &middot; Expected: {line.expectedQty} units
                </span>
              </div>
              <div className="w-28">
                <Input
                  label="Received Qty"
                  type="number"
                  min="0"
                  step="any"
                  value={line.receivedQty}
                  onChange={(e) => handleQtyChange(idx, e.target.value)}
                  required
                  className="text-right font-bold text-xs"
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
          isLoading={receiveMutation.isPending}
        >
          <ArrowDownToLine className="h-4 w-4 mr-1.5" />
          Confirm Dock Receipt
        </Button>
      </div>
    </form>
  );
};

/**
 * Dock Intake Modal wrapper.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object|null} props.rma - RMA document.
 * @returns {JSX.Element|null}
 */
export const ReceiveReturnModal = ({ isOpen, onClose, rma }) => {
  if (!isOpen || !rma) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dock Intake Receipt: ${rma.rmaNumber}`}
      size="md"
    >
      <ReceiveReturnForm rma={rma} onClose={onClose} />
    </Modal>
  );
};

export default ReceiveReturnModal;
