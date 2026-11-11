/**
 * StockPilot WMS - Reusable Select component.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { forwardRef } from 'react';

export const Select = forwardRef(
  ({ label, error, options = [], children, className = '', id, placeholder, ...props }, ref) => {
    const selectId = id || props.name;
    const hasEmptyOption = options.some((opt) => opt.value === '');
    const renderedOptions =
      placeholder && !hasEmptyOption
        ? [{ value: '', label: placeholder }, ...options]
        : options;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`block w-full rounded-lg border py-2 px-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-1 ${
            error
              ? 'border-red-300 focus:border-red-600 focus:ring-red-600'
              : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600'
          } ${className}`}
          {...props}
        >
          {renderedOptions.length > 0
            ? renderedOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

export default Select;
