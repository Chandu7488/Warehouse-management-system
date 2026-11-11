/**
 * StockPilot WMS - Dispatch Transfer Order Modal.
 *
 * Confirms outward dispatch of transfer goods from origin facility,
 * posts TRANSFER_OUT in the stock ledger, and transitions order to IN_TRANSIT.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import { dispatchTransferOrder } from '../transfersApi.js';

/**
 * Dispatch modal form.
 *
 * @param {object} props - Component properties.
 * @param {object} props.order - Transfer order document.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
const DispatchTransferForm = ({ order, onClose }) => {
  const queryClient = useQueryClient();

  const [carrier, setCarrier] = useState(order.carrier || '');
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [formError, setFormError] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => dispatchTransferOrder(order._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-order', order._id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      onClose();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to dispatch transfer order',
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    mutation.mutate({
      carrier: carrier.trim(),
      trackingNumber: trackingNumber.trim(),
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

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        <p className="font-semibold mb-1">Confirming Dispatch for {order.transferNumber}</p>
        <p className="text-xs text-amber-800">
          From: <span className="font-medium">{order.originWarehouse?.name}</span> &rarr; To:{' '}
          <span className="font-medium">{order.destinationWarehouse?.name}</span>
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Dispatching will immediately deduct the items from origin warehouse inventory with
          <code className="mx-1 px-1 bg-amber-100 rounded text-amber-900 font-mono">TRANSFER_OUT</code>
          and place the shipment in transit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Carrier / Transport Line
          </label>
          <Input
            type="text"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            placeholder="e.g. National Freight Express"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Consignment / Tracking Number
          </label>
          <Input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. TRK-78491823"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          Dispatch Notes / Seal Numbers
        </label>
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Truck seal #5492 intact; dispatched via Dock 4"
        />
      </div>

      {/* Item Summary Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          Items to Dispatch ({order.items?.length || 0})
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Source Bin</th>
              <th className="px-3 py-2 text-right">Dispatch Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items?.map((item) => (
              <tr key={item._id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900">
                  {item.product?.sku} - {item.product?.name}
                </td>
                <td className="px-3 py-2 text-slate-600 font-mono">
                  {item.sourceLocation?.code || item.sourceLocation?.name || 'Default Storage'}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">
                  {item.requestedQty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          Confirm Dispatch
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Order Dispatch.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @param {object} props.order - Transfer order record.
 * @returns {JSX.Element|null}
 */
export const DispatchTransferModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dispatch Transfer Order - ${order.transferNumber}`}
      size="lg"
    >
      <DispatchTransferForm order={order} onClose={onClose} />
    </Modal>
  );
};

export default DispatchTransferModal;
