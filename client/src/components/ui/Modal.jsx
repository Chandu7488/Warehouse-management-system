/**
 * StockPilot WMS - Reusable Responsive Modal Dialog Component.
 *
 * Provides a responsive modal container with backdrop blur, keyboard ESC dismissal,
 * outside click-to-close, subtitle/description rendering, scroll-locking, and
 * standardized breakpoint-aware size variants.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';

const SIZE_VARIANTS = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
  '3xl': 'max-w-6xl',
  full: 'max-w-7xl',
};

/**
 * Reusable Responsive Modal Dialog.
 *
 * @param {object} props - Modal props.
 * @param {boolean} props.isOpen - Whether the modal dialog is open.
 * @param {Function} props.onClose - Dismiss callback handler.
 * @param {string|React.ReactNode} props.title - Modal title heading.
 * @param {string|React.ReactNode} [props.description] - Optional contextual subtitle.
 * @param {React.ComponentType} [props.icon] - Optional header icon component.
 * @param {string} [props.size='md'] - Pre-configured size variant ('sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full').
 * @param {string} [props.maxWidth] - Custom max-width Tailwind class override.
 * @param {string} [props.className=''] - Additional class name for modal panel.
 * @param {React.ReactNode} props.children - Modal content payload.
 * @returns {JSX.Element|null} Modal element.
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'md',
  maxWidth,
  className = '',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const resolvedWidth = maxWidth || SIZE_VARIANTS[size] || SIZE_VARIANTS.md;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex min-h-full items-center justify-center p-3 sm:p-6 transition-all animate-in fade-in duration-150"
    >
      <div
        className={`relative w-full ${resolvedWidth} my-auto rounded-2xl bg-white shadow-2xl border border-slate-200/80 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden transition-all ${className}`}
      >
        {/* Sticky Modal Header */}
        <div className="flex items-start justify-between px-6 py-4.5 border-b border-slate-200 bg-slate-50/70 shrink-0 gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 shrink-0 mt-0.5">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 truncate">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Modal Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0 text-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
