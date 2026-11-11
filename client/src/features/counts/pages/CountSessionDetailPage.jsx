/**
 * StockPilot WMS - Count Session Detail & Reconciliation Page.
 *
 * Provides operator blind counting input, variance calculation, recount delegation,
 * and manager transactional stock ledger discrepancy reconciliation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  RotateCcw,
  CheckCircle2,
  Lock,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  fetchCycleCountById,
  startCycleCount,
  submitCountResults,
  requestRecount,
  reconcileCycleCount,
  cancelCycleCount,
} from '../countsApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Badge from '@/components/ui/Badge.jsx';

const STATUS_BADGE_VARIANTS = {
  DRAFT: 'zinc',
  IN_PROGRESS: 'warning',
  COUNTED: 'indigo',
  RECONCILED: 'success',
  CANCELLED: 'danger',
};

/**
 * Count Session Detail Page component.
 *
 * @returns {JSX.Element}
 */
export const CountSessionDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, can: userCan } = useAuth();

  const canApprove =
    userCan(PERMISSIONS.COUNTS_APPROVE) || user?.role === 'ADMIN';
  const canWrite =
    userCan(PERMISSIONS.COUNTS_WRITE) || userCan(PERMISSIONS.INVENTORY_WRITE);

  const [countInputs, setCountInputs] = useState({});
  const [notesInputs, setNotesInputs] = useState({});
  const [selectedForRecount, setSelectedForRecount] = useState([]);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [recountNotes, setRecountNotes] = useState('');
  const [pageError, setPageError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  const { data: countDoc, isLoading, isError } = useQuery({
    queryKey: ['cycle-count-detail', id],
    queryFn: () => fetchCycleCountById(id),
    enabled: Boolean(id),
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => startCycleCount(id),
    onSuccess: () => {
      setSuccessBanner('Cycle count session started! On-hand inventory snapshots frozen.');
      queryClient.invalidateQueries({ queryKey: ['cycle-count-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
    onError: (err) => setPageError(err.response?.data?.message || err.message),
  });

  const submitCountsMutation = useMutation({
    mutationFn: () => {
      const itemsPayload = countDoc.items.map((line) => {
        const lineId = String(line.id || line._id);
        const qtyVal =
          countInputs[lineId] !== undefined ? countInputs[lineId] : line.countedQty;
        return {
          itemId: lineId,
          countedQty: qtyVal === '' || qtyVal === undefined || qtyVal === null ? 0 : Number(qtyVal),
          notes:
            notesInputs[lineId] !== undefined ? notesInputs[lineId] : (line.notes || ''),
        };
      });

      return submitCountResults(id, { items: itemsPayload });
    },
    onSuccess: () => {
      setSuccessBanner('Physical count sheets recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['cycle-count-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
    onError: (err) => setPageError(err.response?.data?.message || err.message),
  });

  const recountMutation = useMutation({
    mutationFn: () =>
      requestRecount(id, {
        itemIds: selectedForRecount,
        notes: recountNotes || 'Recount requested due to physical variance',
      }),
    onSuccess: () => {
      setSelectedForRecount([]);
      setRecountNotes('');
      setSuccessBanner('Recount flagged for selected lines. Session returned to In Progress.');
      queryClient.invalidateQueries({ queryKey: ['cycle-count-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
    onError: (err) => setPageError(err.response?.data?.message || err.message),
  });

  const reconcileMutation = useMutation({
    mutationFn: () =>
      reconcileCycleCount(id, {
        notes: reconcileNotes || 'Discrepancies reconciled by manager sign-off',
      }),
    onSuccess: () => {
      setSuccessBanner('Session successfully reconciled! Stock ledger adjustments have been posted.');
      queryClient.invalidateQueries({ queryKey: ['cycle-count-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
    onError: (err) => setPageError(err.response?.data?.message || err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCycleCount(id, { reason: 'Cancelled by operator' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
    },
    onError: (err) => setPageError(err.response?.data?.message || err.message),
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Loading cycle count session details...
      </div>
    );
  }

  if (isError || !countDoc) {
    return (
      <div className="p-8 text-center text-rose-500">
        Cycle count session not found or failed to load.
      </div>
    );
  }

  const items = countDoc.items || [];
  const status = countDoc.status;
  const isDraft = status === 'DRAFT';
  const isInProgress = status === 'IN_PROGRESS';
  const isCounted = status === 'COUNTED';
  const isReconciled = status === 'RECONCILED';
  const isCancelled = status === 'CANCELLED';

  const totalVarianceValue = (countDoc.netVarianceValueMinor || 0) / 100;

  const toggleSelectRecount = (lineId) => {
    setSelectedForRecount((prev) =>
      prev.includes(lineId) ? prev.filter((i) => i !== lineId) : [...prev, lineId],
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={() => navigate('/counts')}
          >
            All Counts
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono text-slate-900">
                {countDoc.countNumber}
              </h1>
              <Badge variant={STATUS_BADGE_VARIANTS[status] || 'zinc'}>
                {status.replace('_', ' ')}
              </Badge>
              {countDoc.blindCount && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-medium border border-slate-200">
                  <Lock className="w-3 h-3 text-slate-500" />
                  Blind Count
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Facility: <span className="font-medium text-slate-700">{countDoc.warehouse?.name} ({countDoc.warehouse?.code})</span> · Created {new Date(countDoc.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {isDraft && canWrite && (
            <Button
              variant="primary"
              icon={Play}
              loading={startMutation.isPending}
              onClick={() => startMutation.mutate()}
            >
              Start Count &amp; Freeze Snapshot
            </Button>
          )}

          {isInProgress && canWrite && (
            <Button
              variant="primary"
              icon={Check}
              loading={submitCountsMutation.isPending}
              onClick={() => submitCountsMutation.mutate()}
            >
              Submit Physical Counts
            </Button>
          )}

          {isCounted && canApprove && (
            <Button
              variant="primary"
              icon={CheckCircle2}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              loading={reconcileMutation.isPending}
              onClick={() => reconcileMutation.mutate()}
            >
              Reconcile &amp; Post to Ledger
            </Button>
          )}

          {isReconciled && (
            <Button
              variant="outline"
              icon={ExternalLink}
              onClick={() =>
                navigate(`/inventory/ledger?referenceNo=${countDoc.countNumber}`)
              }
            >
              View Stock Ledger
            </Button>
          )}

          {!isReconciled && !isCancelled && canWrite && (
            <Button
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50"
              loading={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this count session?')) {
                  cancelMutation.mutate();
                }
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Alert Banners */}
      {pageError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{pageError}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Target Lines
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {countDoc.totalItems || items.length}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Matched In Stock
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-1">
            {countDoc.matchedItems || 0}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Lines with Variance
          </div>
          <div className="text-xl font-bold text-rose-600 mt-1">
            {countDoc.varianceItems || 0}
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Net Variance Value
          </div>
          <div
            className={`text-xl font-bold mt-1 ${
              totalVarianceValue < 0
                ? 'text-rose-600'
                : totalVarianceValue > 0
                ? 'text-emerald-600'
                : 'text-slate-900'
            }`}
          >
            {totalVarianceValue > 0 ? `+$${totalVarianceValue.toFixed(2)}` : totalVarianceValue < 0 ? `-$${Math.abs(totalVarianceValue).toFixed(2)}` : '$0.00'}
          </div>
        </div>
      </div>

      {/* Recount Selection Banner (When in COUNTED status) */}
      {isCounted && selectedForRecount.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800 font-medium">
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>{selectedForRecount.length} item(s) selected for physical recount</span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              size="sm"
              placeholder="Reason for recount..."
              value={recountNotes}
              onChange={(e) => setRecountNotes(e.target.value)}
              className="w-64"
            />
            <Button
              size="sm"
              variant="outline"
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
              loading={recountMutation.isPending}
              onClick={() => recountMutation.mutate()}
            >
              Send Recount Request
            </Button>
          </div>
        </div>
      )}

      {/* Reconciliation Notes Input (When in COUNTED status) */}
      {isCounted && canApprove && (
        <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            Manager Reconciliation Sign-Off
          </div>
          <p className="text-xs text-indigo-700">
            Reconciling will write ADJUSTMENT_GAIN or ADJUSTMENT_LOSS ledger records for any lines with discrepancies and update on-hand balances.
          </p>
          <Input
            placeholder="Audit reconciliation notes / justification (optional)..."
            value={reconcileNotes}
            onChange={(e) => setReconcileNotes(e.target.value)}
          />
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            {isInProgress ? 'Operator Count Sheet' : 'Audited Items & Discrepancies'}
          </h3>
          <span className="text-xs text-slate-500">
            {items.length} lines total
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            {isDraft
              ? 'No items frozen yet. Click "Start Count & Freeze Snapshot" to populate items from current warehouse balances.'
              : 'No items in this count session.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                <tr>
                  {isCounted && <th className="p-3 w-10">Recount</th>}
                  <th className="p-3">Product / SKU</th>
                  <th className="p-3">Location / Bin</th>
                  <th className="p-3">Batch / Lot</th>
                  <th className="p-3 text-right">
                    {countDoc.blindCount && isInProgress ? 'Expected' : 'Snapshot Qty'}
                  </th>
                  <th className="p-3 text-right">Counted Qty</th>
                  {(!isInProgress || !countDoc.blindCount) && (
                    <>
                      <th className="p-3 text-right">Variance Qty</th>
                      <th className="p-3 text-right">Variance Value</th>
                    </>
                  )}
                  <th className="p-3">Item Status</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {items.map((line) => {
                  const lineId = String(line.id || line._id);
                  const hasDiscrepancy = line.varianceQty !== 0 && line.countedQty !== null;
                  const isSelected = selectedForRecount.includes(lineId);

                  return (
                    <tr
                      key={lineId}
                      className={`hover:bg-slate-50 ${
                        hasDiscrepancy ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {isCounted && (
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRecount(lineId)}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                          />
                        </td>
                      )}

                      <td className="p-3">
                        <div className="font-medium text-slate-900">
                          {line.product?.sku || 'SKU'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {line.product?.name}
                        </div>
                      </td>

                      <td className="p-3">
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-medium">
                          {line.location?.code || 'BIN'}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {line.location?.path}
                        </div>
                      </td>

                      <td className="p-3 text-xs text-slate-500">
                        {line.batch?.batchNumber || '—'}
                      </td>

                      <td className="p-3 text-right font-mono">
                        {countDoc.blindCount && isInProgress ? (
                          <span className="text-xs text-slate-400 italic">
                            [Blind Masked]
                          </span>
                        ) : (
                          <span className="font-medium">{line.snapshotQty}</span>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        {isInProgress ? (
                          <div className="flex justify-end">
                            <Input
                              type="number"
                              min="0"
                              className="w-24 text-right font-mono text-sm py-1"
                              value={
                                countInputs[lineId] !== undefined
                                  ? countInputs[lineId]
                                  : line.countedQty !== null && line.countedQty !== undefined
                                  ? line.countedQty
                                  : ''
                              }
                              onChange={(e) =>
                                setCountInputs({
                                  ...countInputs,
                                  [lineId]: e.target.value,
                                })
                              }
                              placeholder="0"
                            />
                          </div>
                        ) : (
                          <span className="font-mono font-medium">
                            {line.countedQty !== null && line.countedQty !== undefined
                              ? line.countedQty
                              : '—'}
                          </span>
                        )}
                      </td>

                      {(!isInProgress || !countDoc.blindCount) && (
                        <>
                          <td className="p-3 text-right font-mono text-sm">
                            {line.countedQty === null ? (
                              <span className="text-slate-400">—</span>
                            ) : line.varianceQty > 0 ? (
                              <span className="text-emerald-600 font-semibold">
                                +{line.varianceQty}
                              </span>
                            ) : line.varianceQty < 0 ? (
                              <span className="text-rose-600 font-semibold">
                                {line.varianceQty}
                              </span>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </td>

                          <td className="p-3 text-right font-mono text-xs">
                            {line.countedQty === null ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <span>
                                ${(Math.abs(line.varianceValueMinor || 0) / 100).toFixed(2)}
                              </span>
                            )}
                          </td>
                        </>
                      )}

                      <td className="p-3">
                        <Badge
                          variant={
                            line.status === 'APPROVED'
                              ? 'success'
                              : line.status === 'RECOUNT_REQUESTED'
                              ? 'warning'
                              : line.status === 'COUNTED'
                              ? 'info'
                              : 'zinc'
                          }
                          size="xs"
                        >
                          {line.status}
                        </Badge>
                      </td>

                      <td className="p-3">
                        {isInProgress ? (
                          <Input
                            size="sm"
                            placeholder="Count remarks..."
                            value={
                              notesInputs[lineId] !== undefined
                                ? notesInputs[lineId]
                                : line.notes || ''
                            }
                            onChange={(e) =>
                              setNotesInputs({
                                ...notesInputs,
                                [lineId]: e.target.value,
                              })
                            }
                            className="w-40 text-xs"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">{line.notes || '—'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isInProgress && items.length > 0 && canWrite && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
            <Button
              variant="primary"
              icon={Check}
              loading={submitCountsMutation.isPending}
              onClick={() => submitCountsMutation.mutate()}
            >
              Submit Physical Counts
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountSessionDetailPage;
