/**
 * StockPilot WMS - Reusable Empty State component.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items matching your criteria.',
  action = null,
}) => (
  <div className="py-12 px-4 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
