/**
 * StockPilot WMS - Purchase Order Detail & Progress Modal.
 *
 * Displays line-by-line fulfillment progress, supplier contract particulars,
 * and lifecycle action triggers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, ArrowDownToLine, Clock } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { confirmPurchaseOrder, cancelPurchaseOrder } from '../purchasingApi.js';
import { formatMoney } from '@/lib/money.js';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  CONFIRMED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

/**
 * Purchase Order Detail Modal component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.po - Selected purchase order.
 * @param {boolean} props.isOpen - Whether modal is open.
 * @param {Function} props.onClose - Close callback.
 * @param {Function} props.onReceive - Trigger GRN receiving workflow.
 * @param {boolean} [props.canWrite=false] - Privilege indicator.
 * @returns {JSX.Element}
 */
export const PurchaseOrderDetailModal = ({
  po,
  isOpen,
  onClose,
  onReceive,
  canWrite = false,
}) => {
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: () => confirmPurchaseOrder(po?._id || po?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseOrder(po?._id || po?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      onClose();
    },
  });

  if (!po) return null;

  const items = po.items || [];
  const totalOrdered = items.reduce((sum, item) => sum + (item.orderedQty || 0), 0);
  const totalReceived = items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const fulfillmentPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Purchase Order: ${po.poNumber}`}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status</span>
            <div className="mt-1">
              <Badge variant={STATUS_VARIANTS[po.status] || 'secondary'}>
                {po.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Supplier</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {po.supplier?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({po.supplier?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Warehouse</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {po.warehouse?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({po.warehouse?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Order Total</span>
            <p className="mt-1 text-sm font-bold text-indigo-700">
              {formatMoney(po.totalMinor || 0)}
            </p>
          </div>
        </div>

        {/* Delivery & Fulfillment Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>
              Expected Delivery:{' '}
              <strong className="text-slate-800">
                {po.expectedDeliveryDate
                  ? new Date(po.expectedDeliveryDate).toLocaleDateString()
                  : 'Unspecified'}
              </strong>
            </span>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="font-medium text-slate-600">Fulfillment Progress</span>
              <span className="font-semibold text-slate-900">{fulfillmentPct}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${fulfillmentPct}%` }}
              />
            </div>
          </div>
        </div>

        {po.notes && (
          <div className="text-xs bg-slate-100 p-2.5 rounded text-slate-700">
            <strong>Notes:</strong> {po.notes}
          </div>
        )}

        {/* Line Items Breakdown */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Ordered Line Items ({items.length})
          </h4>
          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5 text-center">Ordered</th>
                  <th className="px-3 py-2.5 text-center">Received</th>
                  <th className="px-3 py-2.5 text-center">Remaining</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((line, idx) => {
                  const remaining = Math.max(0, (line.orderedQty || 0) - (line.receivedQty || 0));
                  return (
                    <tr key={line._id || idx}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {line.product?.name || 'Unknown Item'}
                        <div className="text-[11px] text-slate-400 font-mono">
                          {line.product?.sku}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-800">
                        {line.orderedQty}
                      </td>
                      <td className="px-3 py-2.5 text-center text-emerald-600 font-semibold">
                        {line.receivedQty || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">
                        {remaining}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-700">
                        {formatMoney(line.unitPriceMinor || 0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {formatMoney(line.totalPriceMinor || 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex gap-2">
            {canWrite && po.status === 'DRAFT' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => confirmMutation.mutate()}
                isLoading={confirmMutation.isPending}
                className="flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm Order
              </Button>
            )}

            {(po.status === 'CONFIRMED' || po.status === 'PARTIALLY_RECEIVED') && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  onReceive(po);
                }}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Receive Goods (GRN)
              </Button>
            )}

            {canWrite && po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel Order
              </Button>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PurchaseOrderDetailModal;
