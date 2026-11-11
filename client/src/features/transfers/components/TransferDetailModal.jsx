/**
 * StockPilot WMS - Transfer Order Detail Modal.
 *
 * Displays full transfer order lifecycle details, origin/destination facilities,
 * tracking references, item progression, and action triggers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  ArrowDownToLine,
  XCircle,
  Clock,
  ArrowRight,
  PackageCheck,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { fetchTransferOrderById, cancelTransferOrder } from '../transfersApi.js';

const STATUS_VARIANTS = {
  PENDING_DISPATCH: 'info',
  IN_TRANSIT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Transfer Order Detail Modal.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Visibility status.
 * @param {Function} props.onClose - Dismissal callback.
 * @param {string} props.orderId - Transfer order ID.
 * @param {Function} [props.onOpenDispatch] - Trigger dispatch modal.
 * @param {Function} [props.onOpenReceive] - Trigger receive modal.
 * @returns {JSX.Element|null}
 */
export const TransferDetailModal = ({
  isOpen,
  onClose,
  orderId,
  onOpenDispatch,
  onOpenReceive,
}) => {
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['transfer-order', orderId],
    queryFn: () => fetchTransferOrderById(orderId),
    enabled: Boolean(isOpen && orderId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTransferOrder(orderId, 'Cancelled by operator'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfer-orders'] });
      queryClient.invalidateQueries({ queryKey: ['transfer-order', orderId] });
      onClose();
    },
  });

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `Transfer Order: ${order.transferNumber}` : 'Transfer Order Details'}
      size="xl"
    >
      {isLoading || !order ? (
        <div className="py-12 text-center text-slate-500">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-400" />
          Loading transfer order details...
        </div>
      ) : (
        <div className="space-y-5">
          {/* Status & Facility Route Header */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 font-mono">
                  {order.transferNumber}
                </span>
                <Badge variant={STATUS_VARIANTS[order.status] || 'secondary'}>
                  {order.status.replace(/_/g, ' ')}
                </Badge>
                <Badge variant="outline">{order.transferType.replace(/_/g, ' ')}</Badge>
              </div>

              <div className="text-xs text-slate-500">
                Created: {new Date(order.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Origin Facility
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {order.originWarehouse?.code} - {order.originWarehouse?.name}
                </span>
              </div>

              <ArrowRight className="w-5 h-5 text-indigo-500 shrink-0" />

              <div className="flex-1 text-right">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Destination Facility
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {order.destinationWarehouse?.code} - {order.destinationWarehouse?.name}
                </span>
              </div>
            </div>

            {(order.carrier || order.trackingNumber || order.notes) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Carrier:</span>
                  <span className="font-medium text-slate-800">{order.carrier || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tracking #:</span>
                  <span className="font-medium font-mono text-slate-800">
                    {order.trackingNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Notes:</span>
                  <span className="font-medium text-slate-800">{order.notes || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Transfer Manifest ({order.items?.length || 0} line items)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Product SKU & Name</th>
                    <th className="px-3 py-2.5">Origin Bin</th>
                    <th className="px-3 py-2.5">Destination Bin</th>
                    <th className="px-3 py-2.5 text-right">Requested</th>
                    <th className="px-3 py-2.5 text-right">Dispatched</th>
                    <th className="px-3 py-2.5 text-right">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items?.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{item.product?.sku}</div>
                        <div className="text-slate-500">{item.product?.name}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {item.sourceLocation?.code || item.sourceLocation?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {item.destinationLocation?.code || item.destinationLocation?.name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                        {item.requestedQty}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-amber-700">
                        {item.dispatchedQty || 0}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                        {item.receivedQty || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              {order.status === 'PENDING_DISPATCH' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMutation.mutate()}
                  isLoading={cancelMutation.isPending}
                  className="text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancel Order
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>

              {order.status === 'PENDING_DISPATCH' && onOpenDispatch && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    onClose();
                    onOpenDispatch(order);
                  }}
                >
                  <Truck className="w-4 h-4 mr-1.5" />
                  Dispatch Order
                </Button>
              )}

              {order.status === 'IN_TRANSIT' && onOpenReceive && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    onClose();
                    onOpenReceive(order);
                  }}
                >
                  <ArrowDownToLine className="w-4 h-4 mr-1.5" />
                  Receive Order
                </Button>
              )}

              {order.status === 'COMPLETED' && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <PackageCheck className="w-4 h-4" />
                  Fulfillment Complete
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TransferDetailModal;
