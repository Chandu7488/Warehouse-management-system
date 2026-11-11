/**
 * StockPilot WMS - Reusable Badge component.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
const VARIANTS = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export const Badge = ({ children, variant = 'neutral', className = '' }) => {
  const variantClass = VARIANTS[variant] ?? VARIANTS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
