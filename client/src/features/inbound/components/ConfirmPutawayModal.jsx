/**
 * StockPilot WMS - Directed Putaway Task Execution Modal.
 *
 * Allows warehouse staff to review system-directed bin suggestions,
 * override destination bins if needed, and commit transactional stock transfers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, MoveDown, AlertCircle, ArrowRight } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import LocationPicker from '@/components/locations/LocationPicker.jsx';
import { completePutawayTask } from '../inboundApi.js';

/**
 * Inner putaway execution form component.
 *
 * @param {object} props - Component properties.
 * @param {object} props.task - Putaway task.
 * @param {Function} props.onClose - Dismiss callback.
 * @returns {JSX.Element}
 */
const ConfirmPutawayForm = ({ task, onClose }) => {
  const queryClient = useQueryClient();

  const warehouseId = task?.warehouse?._id || task?.warehouse?.id || task?.warehouse || '';
  const suggestedId = task?.suggestedLocation?._id || task?.suggestedLocation?.id || '';

  const [destinationLocation, setDestinationLocation] = useState(suggestedId);
  const [notes, setNotes] = useState('');
  const [actionError, setActionError] = useState(null);

  const completeMutation = useMutation({
    mutationFn: (payload) => completePutawayTask(task?._id || task?.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      onClose();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to complete putaway task',
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    if (!destinationLocation) {
      setActionError('Please select a valid storage destination bin');
      return;
    }

    completeMutation.mutate({
      destinationLocation,
      notes: notes.trim() || undefined,
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

      {/* Product & Quantity Summary */}
      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              {task.product?.name || 'Item'}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              SKU: {task.product?.sku} &middot; Tracking: {task.product?.trackingType}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Quantity</span>
            <p className="text-lg font-bold text-indigo-700">{task.quantity} units</p>
          </div>
        </div>

        {task.batch && (
          <div className="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
            Lot Number: <strong className="font-mono">{task.batch.batchNumber}</strong>
            {task.batch.expiresOn && (
              <span className="ml-2">
                (Expires: {new Date(task.batch.expiresOn).toLocaleDateString()})
              </span>
            )}
          </div>
        )}

        {task.serials && task.serials.length > 0 && (
          <div className="text-xs bg-sky-50 p-2 rounded border border-sky-200">
            <span className="text-sky-900 font-medium">Serialized Assets ({task.serials.length}): </span>
            <span className="font-mono text-sky-800">
              {task.serials.map((s) => s.serialNumber || s).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Transfer Route */}
      <div className="flex items-center justify-between gap-3 p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 text-xs">
        <div className="flex-1">
          <span className="text-slate-500 font-medium">Source Location (Dock)</span>
          <div className="font-mono font-semibold text-slate-800 mt-0.5">
            {task.sourceLocation?.path || task.sourceLocation?.code || 'RECEIVING'}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />

        <div className="flex-1">
          <span className="text-indigo-600 font-medium flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Suggested Optimal Bin
          </span>
          <div className="font-mono font-bold text-indigo-900 mt-0.5">
            {task.suggestedLocation?.path || task.suggestedLocation?.code || 'STORAGE'}
          </div>
        </div>
      </div>

      {/* Destination Location Override Picker */}
      <div>
        <LocationPicker
          warehouseId={warehouseId}
          value={destinationLocation}
          onChange={(locId) => setDestinationLocation(locId)}
          purpose="STORAGE"
          allowedType="BIN"
          label="Confirmed Destination Bin"
          placeholder="Select destination storage bin..."
          required
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Defaulted to the system-directed suggestion. You may select another storage bin if this slot is full.
        </p>
      </div>

      <Input
        label="Putaway Notes (Optional)"
        placeholder="e.g. Placed on top shelf tier 2"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={completeMutation.isPending}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700"
        >
          <MoveDown className="h-4 w-4" />
          Confirm &amp; Move Stock
        </Button>
      </div>
    </form>
  );
};

/**
 * Confirm Putaway Modal component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.task - Putaway task to execute.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
export const ConfirmPutawayModal = ({ task, isOpen, onClose }) => {
  if (!task) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Execute Putaway: ${task.taskNumber}`}
      size="lg"
    >
      <ConfirmPutawayForm
        key={task._id || task.id}
        task={task}
        onClose={onClose}
      />
    </Modal>
  );
};

export default ConfirmPutawayModal;
