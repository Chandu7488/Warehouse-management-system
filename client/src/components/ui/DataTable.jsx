/**
 * StockPilot WMS - Reusable Data Table component with pagination.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import EmptyState from './EmptyState.jsx';
import Button from './Button.jsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DataTable = ({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'No records available',
  pagination = null,
  onPageChange = null,
}) => {
  const page = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;
  const total = pagination?.total ?? 0;
  const handlePageChange = pagination?.onPageChange || onPageChange;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              {columns.map((col) => (
                <th key={col.key || col.header} className={`px-4.5 py-3 ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-sm text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <span>Loading data...</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            )}

            {!isLoading &&
              data.map((row, idx) => {
                const rowKey =
                  (row.id && typeof row.id !== 'object' ? String(row.id) : null) ||
                  (row._id && typeof row._id !== 'object' ? String(row._id) : null) ||
                  (row.batchNumber ? `${row.batchNumber}-${idx}` : null) ||
                  (row.sku ? `${row.sku}-${row.warehouse || ''}-${idx}` : null) ||
                  (row.reference ? `${row.reference}-${idx}` : null) ||
                  idx;
                return (
                  <tr key={rowKey} className="hover:bg-slate-50/80 transition-colors">
                  {columns.map((col) => {
                    let content;
                    if (col.render) {
                      content = col.render(row);
                    } else if (col.cell) {
                      content = col.cell({ row: { original: row }, getValue: () => row[col.key || col.accessorKey] });
                    } else {
                      content = row[col.key || col.accessorKey];
                    }

                    return (
                      <td
                        key={col.key || col.accessorKey || col.header}
                        className={`whitespace-nowrap px-4.5 py-3 text-slate-700 ${col.className ?? ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-white text-xs text-slate-600">
          <div>
            Showing page <span className="font-semibold">{page}</span> of{' '}
            <span className="font-semibold">{totalPages}</span> ({total} total)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange && handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange && handlePageChange(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;
