/**
 * StockPilot WMS - Goods Receipt Detail Modal.
 *
 * Inspects recorded inbound shipments, QA condition outcomes, batch/lot metadata,
 * and serial assignments.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useNavigate } from 'react-router-dom';
import { MoveDown } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';

const STATUS_VARIANTS = {
  RECEIVED: 'info',
  INSPECTED: 'secondary',
  PUTAWAY_IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

/**
 * Goods Receipt Detail Modal component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} props.grn - Selected goods receipt.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Modal close handler.
 * @returns {JSX.Element}
 */
export const GoodsReceiptDetailModal = ({ grn, isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!grn) return null;

  const items = grn.items || [];
  const totalReceived = items.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const totalRejected = items.reduce((sum, item) => sum + (item.rejectedQty || 0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Goods Receipt Note: ${grn.grnNumber}`}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Status</span>
            <div className="mt-1">
              <Badge variant={STATUS_VARIANTS[grn.status] || 'secondary'}>
                {grn.status}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Supplier</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {grn.supplier?.name || 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-500">({grn.supplier?.code})</span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Warehouse & Dock</span>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {grn.warehouse?.code || 'N/A'} &middot;{' '}
              <span className="text-xs font-mono text-indigo-700">
                {grn.receivingLocation?.path || grn.receivingLocation?.code || 'RECEIVING'}
              </span>
            </p>
          </div>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Linked PO</span>
            <p className="mt-1 text-sm font-semibold text-slate-900 font-mono">
              {grn.purchaseOrder?.poNumber || 'Direct Intake'}
            </p>
          </div>
        </div>

        {/* Carrier and Logistics Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-100 p-3 rounded-lg">
          <div>
            <span className="text-slate-500">Carrier:</span>{' '}
            <strong className="text-slate-800">{grn.carrier || 'N/A'}</strong>
          </div>
          <div>
            <span className="text-slate-500">Tracking #:</span>{' '}
            <strong className="text-slate-800 font-mono">{grn.trackingNumber || 'N/A'}</strong>
          </div>
          <div>
            <span className="text-slate-500">Intake Timestamp:</span>{' '}
            <strong className="text-slate-800">
              {new Date(grn.createdAt).toLocaleString()}
            </strong>
          </div>
        </div>

        {grn.notes && (
          <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700">
            <strong>Notes:</strong> {grn.notes}
          </div>
        )}

        {/* Received Line Items Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Received Items ({items.length}) &middot; Total Units: {totalReceived} (Rejected: {totalRejected})
            </h4>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Product</th>
                  <th className="px-3 py-2.5 text-center">Received</th>
                  <th className="px-3 py-2.5 text-center">Rejected</th>
                  <th className="px-3 py-2.5">Condition</th>
                  <th className="px-3 py-2.5">Batch / Serials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((line, idx) => (
                  <tr key={line._id || idx}>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {line.product?.name || 'Item'}
                      <div className="text-[11px] text-slate-400 font-mono">
                        {line.product?.sku}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-600">
                      {line.receivedQty}
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-slate-500">
                      {line.rejectedQty || 0}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          line.condition === 'ACCEPTABLE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {line.condition}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {line.batchNumber ? (
                        <div className="text-slate-800">
                          <span className="font-mono font-semibold text-amber-700">
                            {line.batchNumber}
                          </span>
                          {line.expiresOn && (
                            <span className="text-[11px] text-slate-500 ml-1.5">
                              (Exp: {new Date(line.expiresOn).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      ) : null}

                      {line.serialNumbers && line.serialNumbers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {line.serialNumbers.map((sn, sIdx) => (
                            <span
                              key={sIdx}
                              className="bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded font-mono text-[10px]"
                            >
                              {sn}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {!line.batchNumber && (!line.serialNumbers || line.serialNumbers.length === 0) && (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              navigate('/inbound/putaway');
            }}
            className="flex items-center gap-1.5 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          >
            <MoveDown className="h-4 w-4" />
            View Generated Putaway Tasks
          </Button>

          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default GoodsReceiptDetailModal;
