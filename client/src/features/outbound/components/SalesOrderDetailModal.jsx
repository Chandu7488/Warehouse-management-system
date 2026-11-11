/**
 * StockPilot WMS - Sales Order Detail & Fulfillment Modal.
 *
 * Provides deep visibility into sales order commitments, item-level allocations,
 * FEFO/FIFO stock reservations, and outbound dispatch transitions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Layers,
  ArrowRight,
  Truck,
  MapPin,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';
import {
  confirmSalesOrder,
  allocateSalesOrder,
  cancelSalesOrder,
} from '../salesOrdersApi.js';
import { formatMoney } from '@/lib/money.js';

const STATUS_VARIANTS = {
  DRAFT: 'secondary',
  CONFIRMED: 'info',
  ALLOCATED: 'warning',
  PICKING: 'warning',
  PACKED: 'info',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

/**
 * Sales Order Detail Modal component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.order - Selected sales order.
 * @param {boolean} props.isOpen - Whether modal is open.
 * @param {Function} props.onClose - Modal dismissal callback.
 * @param {Function} [props.onCreatePickWave] - Callback to trigger pick list wave creation.
 * @param {Function} [props.onCreateShipment] - Callback to trigger shipment packaging.
 * @param {boolean} [props.canWrite=false] - Privilege indicator for order mutations.
 * @param {boolean} [props.canPick=false] - Privilege indicator for pick list wave creation.
 * @param {boolean} [props.canShip=false] - Privilege indicator for dispatch execution.
 * @returns {JSX.Element|null}
 */
export const SalesOrderDetailModal = ({
  order,
  isOpen,
  onClose,
  onCreatePickWave,
  onCreateShipment,
  canWrite = false,
  canPick = false,
  canShip = false,
}) => {
  const queryClient = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: () => confirmSalesOrder(order?._id || order?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      onClose();
    },
  });

  const allocateMutation = useMutation({
    mutationFn: () => allocateSalesOrder(order?._id || order?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      onClose();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelSalesOrder(order?._id || order?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      onClose();
    },
  });

  if (!order) return null;

  const items = order.items || [];
  const totalOrdered = items.reduce((sum, item) => sum + (item.orderedQty || 0), 0);
  const totalAllocated = items.reduce((sum, item) => sum + (item.allocatedQty || 0), 0);
  const totalPicked = items.reduce((sum, item) => sum + (item.pickedQty || 0), 0);
  const totalShipped = items.reduce((sum, item) => sum + (item.shippedQty || 0), 0);

  const allocationPct = totalOrdered > 0 ? Math.round((totalAllocated / totalOrdered) * 100) : 0;
  const pickedPct = totalOrdered > 0 ? Math.round((totalPicked / totalOrdered) * 100) : 0;
  const shippedPct = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;

  const addr = order.shippingAddress || {};
  const formattedAddress = [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    .filter(Boolean)
    .join(', ');

  const activeError =
    confirmMutation.error?.response?.data?.message ||
    allocateMutation.error?.response?.data?.message ||
    cancelMutation.error?.response?.data?.message;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Sales Order: ${order.soNumber}`}
      size="2xl"
    >
      <div className="space-y-6">
        {activeError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{activeError}</span>
          </div>
        )}

        {/* Header Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status</span>
            <div className="mt-1">
              <Badge variant={STATUS_VARIANTS[order.status] || 'secondary'}>
                {order.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Customer</span>
            <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
              {order.customer?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({order.customer?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Warehouse</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {order.warehouse?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({order.warehouse?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Total Amount</span>
            <p className="mt-1 text-base font-bold text-indigo-700">
              {formatMoney(order.totalMinor ?? order.totalAmountMinor ?? 0, order.currency || 'USD')}
            </p>
          </div>
        </div>

        {/* Shipping Destination & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-white rounded-lg border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-700">Ship To:</span>
              <p className="text-slate-600 mt-0.5">{formattedAddress || 'No shipping address recorded'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-slate-700">Requested Delivery Date:</span>
              <p className="text-slate-600 mt-0.5">
                {order.requestedDeliveryDate
                  ? new Date(order.requestedDeliveryDate).toLocaleDateString()
                  : 'Unspecified'}
              </p>
            </div>
          </div>
        </div>

        {/* Fulfillment Pipeline Progress */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Outbound Pipeline Progress
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Ordered: {totalOrdered} | Alloc: {totalAllocated} | Pick: {totalPicked} | Ship: {totalShipped}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Allocated</span>
                <span>{allocationPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${allocationPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Picked</span>
                <span>{pickedPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${pickedPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                <span>Shipped</span>
                <span>{shippedPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${shippedPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Ordered Line Items Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Order Items ({items.length})
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-medium text-slate-600">
                <tr>
                  <th className="px-3 py-2">Product / SKU</th>
                  <th className="px-3 py-2 text-right">Ordered</th>
                  <th className="px-3 py-2 text-right">Allocated</th>
                  <th className="px-3 py-2 text-right">Picked</th>
                  <th className="px-3 py-2 text-right">Shipped</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((line, idx) => (
                  <tr key={line._id || line.id || idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-900 block">
                        {line.product?.name || 'Unknown Item'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {line.product?.sku || 'SKU'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-900">
                      {line.orderedQty}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-amber-700">
                      {line.allocatedQty || 0}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-indigo-700">
                      {line.pickedQty || 0}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-700">
                      {line.shippedQty || 0}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">
                      {formatMoney(line.unitPriceMinor || 0, order.currency || 'USD')}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">
                      {formatMoney(line.totalPriceMinor || 0, order.currency || 'USD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allocations Breakdown (if any allocated) */}
        {items.some((it) => it.allocations && it.allocations.length > 0) && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              Stock Allocation Breakdown (FEFO / FIFO Bins)
            </h4>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 font-medium text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Product SKU</th>
                    <th className="px-3 py-2">Assigned Bin Location</th>
                    <th className="px-3 py-2">Lot / Batch</th>
                    <th className="px-3 py-2 text-right">Allocated Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.flatMap((line) =>
                    (line.allocations || []).map((alloc, aIdx) => (
                      <tr key={alloc._id || alloc.id || aIdx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-slate-800">
                          {line.product?.sku}
                        </td>
                        <td className="px-3 py-2 font-mono text-indigo-700 font-semibold">
                          {alloc.location?.path || alloc.location?.code || 'Bin Location'}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {alloc.batch?.batchNumber ? (
                            <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Lot: {alloc.batch.batchNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">Standard / Non-lot</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {alloc.quantity}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div>
            {order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && canWrite && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1.5" />
                Cancel Order
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>

            {order.status === 'DRAFT' && canWrite && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => confirmMutation.mutate()}
                isLoading={confirmMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Confirm &amp; Reserve Stock
              </Button>
            )}

            {order.status === 'CONFIRMED' && canWrite && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => allocateMutation.mutate()}
                isLoading={allocateMutation.isPending}
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Allocate Inventory
              </Button>
            )}

            {(order.status === 'CONFIRMED' || order.status === 'ALLOCATED') && canPick && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onCreatePickWave) onCreatePickWave(order);
                }}
              >
                <ArrowRight className="h-4 w-4 mr-1.5" />
                Create Pick Wave
              </Button>
            )}

            {(order.status === 'ALLOCATED' || order.status === 'PICKING' || order.status === 'PACKED') && canShip && (
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  onClose();
                  if (onCreateShipment) onCreateShipment(order);
                }}
              >
                <Truck className="h-4 w-4 mr-1.5" />
                Create Shipment
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SalesOrderDetailModal;
