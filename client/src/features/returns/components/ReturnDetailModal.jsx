/**
 * StockPilot WMS - Return Order Detail & Inspection Overview Modal.
 *
 * Displays RMA tracking particulars, line-by-line quality inspection grades,
 * and ledger disposition status.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Truck,
  ClipboardCheck,
  ArrowDownToLine,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { cancelReturnOrder } from '../returnsApi.js';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  PENDING_RECEIPT: 'info',
  RECEIVED: 'warning',
  UNDER_INSPECTION: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const CONDITION_VARIANTS = {
  NEW: 'success',
  LIKE_NEW: 'info',
  DAMAGED: 'danger',
  DEFECTIVE: 'danger',
  EXPIRED: 'secondary',
};

const DISPOSITION_VARIANTS = {
  PENDING: 'secondary',
  RESTOCK: 'success',
  QUARANTINE: 'warning',
  SCRAP: 'danger',
  RETURN_TO_VENDOR: 'info',
};

/**
 * Return Order Detail Modal.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.rma - Selected RMA.
 * @param {boolean} props.isOpen - Whether modal is open.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {Function} [props.onReceiveDock] - Callback to trigger dock receiving.
 * @param {Function} [props.onInspect] - Callback to trigger QA disposition.
 * @param {boolean} [props.canWrite=false] - Privilege indicator.
 * @returns {JSX.Element|null}
 */
export const ReturnDetailModal = ({
  rma,
  isOpen,
  onClose,
  onReceiveDock,
  onInspect,
  canWrite = false,
}) => {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: () => cancelReturnOrder(rma?._id || rma?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['return-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      onClose();
    },
  });

  if (!rma) return null;

  const items = rma.items || [];
  const isCustomer = rma.returnType === 'CUSTOMER_RETURN';
  const partner = isCustomer ? rma.customer : rma.supplier;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Return Order: ${rma.rmaNumber}`}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Header Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Type</span>
            <div className="mt-1">
              <Badge variant={isCustomer ? 'info' : 'secondary'}>
                {isCustomer ? 'Customer Return' : 'Supplier Return'}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status</span>
            <div className="mt-1">
              <Badge variant={STATUS_VARIANTS[rma.status] || 'secondary'}>
                {rma.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              {isCustomer ? 'Customer' : 'Supplier'}
            </span>
            <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
              {partner?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({partner?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Warehouse</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {rma.warehouse?.name || 'Facility'}{' '}
              <span className="text-xs font-normal text-slate-500">({rma.warehouse?.code})</span>
            </p>
          </div>
        </div>

        {/* Tracking & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <Truck className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-700">Tracking / Waybill:</span>
              <p className="font-mono text-slate-800 mt-0.5">
                {rma.trackingNumber || 'No tracking specified'}
              </p>
            </div>
          </div>

          <div>
            <span className="font-semibold text-slate-700">Internal Notes:</span>
            <p className="text-slate-600 mt-0.5">{rma.notes || 'No notes provided'}</p>
          </div>
        </div>

        {/* Items Breakdown Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Returned Lines ({items.length})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="px-3 py-2">Product / SKU</th>
                  <th className="px-3 py-2 text-right">Expected</th>
                  <th className="px-3 py-2 text-right">Received</th>
                  <th className="px-3 py-2 text-right">Inspected</th>
                  <th className="px-3 py-2">Condition</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Disposition</th>
                  <th className="px-3 py-2">Bin Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((line, idx) => (
                  <tr key={line._id || line.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-900 block">
                        {line.product?.name || 'Item'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {line.product?.sku}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {line.expectedQty}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                      {line.receivedQty || 0}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                      {line.inspectedQty || 0}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={CONDITION_VARIANTS[line.condition] || 'secondary'}>
                        {line.condition}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <span>{line.reason?.replace(/_/g, ' ')}</span>
                      {line.reasonNotes && (
                        <span className="block text-[11px] text-slate-400 truncate max-w-xs">
                          {line.reasonNotes}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={DISPOSITION_VARIANTS[line.disposition] || 'secondary'}>
                        {line.disposition}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">
                      {line.targetLocation?.path || line.targetLocation?.code || (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolved Banner */}
        {rma.status === 'COMPLETED' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              This return order has been fully inspected and resolved. Inventory ledger movements
              and stock balances have been updated.
            </span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div>
            {rma.status !== 'COMPLETED' && rma.status !== 'CANCELLED' && canWrite && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Cancel RMA
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>

            {(rma.status === 'PENDING_RECEIPT' || rma.status === 'DRAFT') && canWrite && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onReceiveDock) onReceiveDock(rma);
                }}
              >
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Receive at Dock
              </Button>
            )}

            {(rma.status === 'RECEIVED' || rma.status === 'UNDER_INSPECTION') && canWrite && (
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onInspect) onInspect(rma);
                }}
              >
                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                Quality Inspection &amp; Disposition
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReturnDetailModal;
