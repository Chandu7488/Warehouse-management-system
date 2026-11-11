/**
 * StockPilot WMS - Product Stock Breakdown Modal.
 *
 * Displays a granular breakdown of physical stock across warehouses, storage bins,
 * and lots for a specific product catalog item.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useQuery } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { fetchProductStock } from '../inventoryApi.js';

/**
 * Product Stock Details Modal component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object} [props.product] - Target product document.
 * @returns {JSX.Element}
 */
export const ProductStockModal = ({ isOpen, onClose, product }) => {
  const { data: stockResponse, isLoading } = useQuery({
    queryKey: ['product-stock', product?.id || product?._id],
    queryFn: () => fetchProductStock(product?.id || product?._id),
    enabled: Boolean(isOpen && (product?.id || product?._id)),
  });

  if (!product) return null;

  const stockEntries = stockResponse?.items || (Array.isArray(stockResponse) ? stockResponse : []);
  const totalOnHand =
    stockResponse?.onHand ?? stockEntries.reduce((sum, s) => sum + (s.onHand || 0), 0);
  const totalReserved =
    stockResponse?.allocated ?? stockEntries.reduce((sum, s) => sum + (s.reserved || 0), 0);
  const totalAvailable = stockResponse?.available ?? Math.max(0, totalOnHand - totalReserved);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock Breakdown: ${product.sku}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700 border border-slate-200">
          <p className="font-semibold text-slate-900">{product.name}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-xs text-slate-500 block">Total On Hand</span>
              <span className="text-base font-bold text-slate-900">
                {totalOnHand} {product.unit?.code}
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-xs text-slate-500 block">Reserved</span>
              <span className="text-base font-bold text-amber-600">
                {totalReserved} {product.unit?.code}
              </span>
            </div>
            <div className="bg-white p-2 rounded border border-slate-200">
              <span className="text-xs text-slate-500 block">Available</span>
              <span className="text-base font-bold text-emerald-600">
                {totalAvailable} {product.unit?.code}
              </span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Loading storage locations...
          </div>
        ) : !stockEntries || stockEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No stock currently on hand in any warehouse facility.
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Warehouse</th>
                  <th className="p-2.5">Location Path</th>
                  <th className="p-2.5">Batch / Lot</th>
                  <th className="p-2.5 text-right">On Hand</th>
                  <th className="p-2.5 text-right">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockEntries.map((row) => (
                  <tr key={row.id || row._id} className="hover:bg-slate-50/50">
                    <td className="p-2.5 font-medium text-slate-800">
                      {row.warehouse?.name} ({row.warehouse?.code})
                    </td>
                    <td className="p-2.5 font-mono text-indigo-700">{row.location?.path}</td>
                    <td className="p-2.5">
                      {row.batch ? (
                        <Badge variant="warning">{row.batch.batchNumber}</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-semibold text-slate-900">{row.onHand}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-600">
                      {Math.max(0, (row.onHand || 0) - (row.reserved || 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex justify-end pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
