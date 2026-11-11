/**
 * StockPilot WMS - Guided Wave Pick Execution Modal.
 *
 * Implements an interactive picking terminal presenting sorted aisle-walk tasks,
 * bin location verification, lot confirmation, and live progress tracking.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Check,
  Layers,
  Sparkles,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { startPickList, confirmPickItem } from '../pickingApi.js';

/**
 * Single task line picking item component.
 *
 * @param {object} props - Component properties.
 * @param {object} props.item - Pick item line.
 * @param {number} props.index - 0-indexed position in walk sequence.
 * @param {string} props.pickListId - Parent pick list ID.
 * @param {boolean} props.isActive - Whether pick list is in progress.
 * @returns {JSX.Element}
 */
const PickTaskLine = ({ item, index, pickListId, isActive }) => {
  const queryClient = useQueryClient();
  const [pickedQty, setPickedQty] = useState(item.quantity - (item.pickedQuantity || 0));
  const [errorMsg, setErrorMsg] = useState(null);

  const confirmMutation = useMutation({
    mutationFn: () =>
      confirmPickItem(pickListId, item._id || item.id, {
        pickedQty: Number(pickedQty),
        batch: item.batch?._id || item.batch?.id || item.batch || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pick-lists'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.message || err.message || 'Pick confirmation failed');
    },
  });

  const isPicked = item.status === 'PICKED';

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isPicked
          ? 'bg-emerald-50/40 border-emerald-200'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
              isPicked
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            {isPicked ? <Check className="h-4 w-4" /> : index + 1}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-900">
                {item.product?.name || 'Item'}
              </span>
              <span className="font-mono text-xs text-slate-500">
                ({item.product?.sku})
              </span>
              <Badge variant={isPicked ? 'success' : 'secondary'}>
                {item.status}
              </Badge>
            </div>

            {/* Aisle & Bin Walk Path */}
            <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-indigo-700">
              <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span>
                Pick from: <strong className="font-mono">{item.location?.path || item.location?.code || 'Bin'}</strong>
              </span>
            </div>

            {/* Batch / Lot Details */}
            {item.batch && (
              <div className="mt-1 text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-mono">
                Lot: <strong>{item.batch.batchNumber}</strong>
                {item.batch.expiresOn && (
                  <span className="ml-1 text-[11px] text-amber-700">
                    (Exp: {new Date(item.batch.expiresOn).toLocaleDateString()})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quantities & Confirmation Form */}
        <div className="flex items-center gap-3 ml-auto">
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium block">
              Required Qty
            </span>
            <span className="text-base font-bold text-slate-900">
              {item.quantity} units
            </span>
          </div>

          {!isPicked && isActive && (
            <div className="flex items-center gap-2">
              <div className="w-20">
                <Input
                  type="number"
                  min="0.01"
                  max={item.quantity}
                  step="any"
                  value={pickedQty}
                  onChange={(e) => setPickedQty(e.target.value)}
                  className="text-right font-bold text-sm"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setErrorMsg(null);
                  confirmMutation.mutate();
                }}
                isLoading={confirmMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Pick
              </Button>
            </div>
          )}

          {isPicked && (
            <div className="rounded-md bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Picked ({item.pickedQuantity || item.quantity})
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded bg-red-50 p-2 text-xs text-red-700 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Execute Pick Modal component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.pickList - Target pick list.
 * @param {boolean} props.isOpen - Whether modal is active.
 * @param {Function} props.onClose - Dismiss callback.
 * @returns {JSX.Element|null}
 */
export const ExecutePickModal = ({ pickList, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState(null);

  const startMutation = useMutation({
    mutationFn: () => startPickList(pickList?._id || pickList?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pick-lists'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to start pick list');
    },
  });

  if (!pickList) return null;

  const items = pickList.items || [];
  const pickedCount = items.filter((it) => it.status === 'PICKED').length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((pickedCount / totalCount) * 100) : 0;
  const isComplete = pickList.status === 'COMPLETED' || (totalCount > 0 && pickedCount === totalCount);
  const isInProgress = pickList.status === 'IN_PROGRESS';
  const isPending = pickList.status === 'PENDING';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Pick Wave Execution: ${pickList.pickNumber}`}
      size="2xl"
    >
      <div className="space-y-6">
        {actionError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Wave Summary Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status</span>
            <div className="mt-1">
              <Badge
                variant={
                  isComplete
                    ? 'success'
                    : isInProgress
                    ? 'warning'
                    : isPending
                    ? 'info'
                    : 'secondary'
                }
              >
                {pickList.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Warehouse</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {pickList.warehouse?.name || 'N/A'}
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Staging Dock</span>
            <p className="mt-1 text-sm font-semibold text-indigo-700 font-mono">
              {pickList.stagingLocation?.path || pickList.stagingLocation?.code || 'Outbound Dock'}
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Orders Included</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {pickList.salesOrders?.length || 1} orders
            </p>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Pick Progress: {pickedCount} / {totalCount} Items Completed
            </span>
            <span className="text-xs font-bold text-indigo-600">{progressPct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isComplete ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Completed Banner */}
        {isComplete && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Pick Wave Fully Completed!</h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                All items have been verified and staged at{' '}
                <strong className="font-mono">
                  {pickList.stagingLocation?.path || pickList.stagingLocation?.code || 'Outbound Dock'}
                </strong>
                . Associated sales orders are ready for packing and shipment dispatch.
              </p>
            </div>
          </div>
        )}

        {/* Pending Wave Call-to-action */}
        {isPending && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-amber-900">Wave Pending Start</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Click Start Pick Wave to begin the directed walk sequence through warehouse aisles.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => startMutation.mutate()}
              isLoading={startMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Start Wave
            </Button>
          </div>
        )}

        {/* Task Sequence List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-indigo-600" />
              Optimized Aisle Walk Sequence ({items.length} Tasks)
            </h4>
            <span className="text-xs text-slate-400">Sorted by Bin Location Path</span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <PickTaskLine
                key={item._id || item.id || idx}
                item={item}
                index={idx}
                pickListId={pickList._id || pickList.id}
                isActive={isInProgress}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-200">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ExecutePickModal;
