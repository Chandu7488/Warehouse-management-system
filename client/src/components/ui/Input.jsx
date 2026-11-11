/**
 * StockPilot WMS - Reusable Input component.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { forwardRef } from 'react';

export const Input = forwardRef(
  ({ label, error, helperText, className = '', id, leftIcon, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`block w-full rounded-lg border py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 ${
              leftIcon ? 'pl-9' : ''
            } ${
              error
                ? 'border-red-300 focus:border-red-600 focus:ring-red-600'
                : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-600'
            } ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
