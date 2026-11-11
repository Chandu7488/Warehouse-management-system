/**
 * StockPilot WMS - Global route error boundary component.
 *
 * Displays a graceful fallback interface when unhandled runtime errors occur,
 * with diagnostic error details and recovery navigation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useRouteError, Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import Button from '@/components/ui/Button.jsx';

/**
 * Global route error presentation component.
 *
 * @returns {JSX.Element}
 */
export default function ErrorPage() {
  const error = useRouteError();
  const errorMessage =
    error?.statusText || error?.message || 'An unexpected application error occurred.';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          StockPilot encountered an unexpected issue while rendering this view.
        </p>

        {errorMessage && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left text-xs font-mono text-red-700 overflow-x-auto">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Page
          </Button>

          <Link to="/">
            <Button className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
