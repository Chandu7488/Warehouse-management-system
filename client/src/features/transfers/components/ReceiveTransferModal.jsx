/**
 * StockPilot WMS - Receive Transfer Order Modal.
 *
 * Confirms arrival and intake of in-transit transfer stock at the destination warehouse,
 * assigns destination storage bins, and posts TRANSFER_IN stock ledger movements.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { receiveTransferOrder } from '../transfersApi.js';

/**
 * Inner receiving form.
 *
 * @param {object} props - Component properties.
 * @param {object} props.order - Transfer order document.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
const ReceiveTransferForm = ({ order, onClose }) => {
  const queryClient = useQueryClient();

  // Fetch destination warehouse bins (limit capped at 100 by API schema)
  const destWarehouseId = order.destinationWarehouse?._id || order.destinationWarehouse?.id || order.destinationWarehouse;
  const { data: locationsData } = useQuery({
    queryKey: ['locations-dest', destWarehouseId],
    queryFn: () => fetchLocations({ warehouse: destWarehouseId, limit: 100 }),
    enabled: Boolean(destWarehouseId),
  });
  const destinationLocations = locationsData?.items || [];
  const binsOnly = destinationLocations.filter((loc) => loc.type === 'BIN');
  const selectableDestBins = binsOnly.length > 0 ? binsOnly : destinationLocations;

  const [receivedLines, setReceivedLines] = useState(
    order.items?.map((item) => ({
      itemId: item.id || item._id,
      product: item.product,
      dispatchedQty: item.dispatchedQty || item.requestedQty,
      receivedQty: item.dispatchedQty || item.requestedQty,
      destinationLocationId: item.destinationLocation?.id || item.destinationLocation?._id || '',
    })) || [],
  );

  const [formError, setFormError] = useState('');

  const handleUpdateLine = (itemId, field, value) => {
    setReceivedLines((prev) =>
      prev.map((line) => (line.itemId === itemId ? { ...line, [field]: value } : line)),
    );
  };

  const mutation = useMutation({
    mutationFn: (payload) => receiveTransferOrder(order._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-order', order._id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['replenishment-needs'] });
      onClose();
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to receive transfer order',
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    for (let i = 0; i < receivedLines.length; i += 1) {
      const line = receivedLines[i];
      if (!line.destinationLocationId) {
        setFormError(`Line #${i + 1}: Please select a destination storage bin.`);
        return;
      }
      const qty = Number(line.receivedQty);
      if (!qty || qty <= 0) {
        setFormError(`Line #${i + 1}: Received quantity must be positive.`);
        return;
      }
    }

    mutation.mutate({
      items: receivedLines.map((line) => ({
        itemId: line.itemId,
        receivedQty: Number(line.receivedQty),
        destinationLocationId: line.destinationLocationId,
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

      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-900">
        <p className="font-semibold mb-1">Receiving Intake for {order.transferNumber}</p>
        <p className="text-xs text-emerald-800">
          Receiving Facility: <span className="font-medium">{order.destinationWarehouse?.name}</span>
          {order.carrier && ` · Carrier: ${order.carrier}`}
          {order.trackingNumber && ` · Track: ${order.trackingNumber}`}
        </p>
        <p className="text-xs text-emerald-700 mt-1">
          Stock will be posted to the ledger with
          <code className="mx-1 px-1 bg-emerald-100 rounded text-emerald-900 font-mono">TRANSFER_IN</code>
          and deposited into the chosen destination bins.
        </p>
      </div>

      {/* Receiving Lines */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Arrival Lines ({receivedLines.length})
        </div>

        <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
          {receivedLines.map((line, idx) => (
            <div
              key={line.itemId}
              className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Line #{idx + 1}: {line.product?.sku} - {line.product?.name}
                </span>
                <span className="text-xs text-slate-500">
                  Dispatched: <strong className="text-slate-800">{line.dispatchedQty}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Destination Storage Bin
                  </label>
                  <Select
                    value={line.destinationLocationId}
                    onChange={(e) =>
                      handleUpdateLine(line.itemId, 'destinationLocationId', e.target.value)
                    }
                    options={selectableDestBins.map((loc) => ({
                      value: loc.id || loc._id,
                      label: `${loc.code} (${loc.path || loc.purpose})`,
                    }))}
                    placeholder="Assign destination bin..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                    Received Quantity
                  </label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={line.receivedQty}
                    onChange={(e) =>
                      handleUpdateLine(line.itemId, 'receivedQty', e.target.value)
                    }
                    required
                  />
                </div>
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
          <ArrowDownToLine className="w-4 h-4 mr-1.5" />
          Complete Intake & Deposit Stock
        </Button>
      </div>
    </form>
  );
};

/**
 * Modal wrapper for Receiving Transfer Order.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @param {object} props.order - Transfer order document.
 * @returns {JSX.Element|null}
 */
export const ReceiveTransferModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Receive Transfer Order - ${order.transferNumber}`}
      size="lg"
    >
      <ReceiveTransferForm order={order} onClose={onClose} />
    </Modal>
  );
};

export default ReceiveTransferModal;
