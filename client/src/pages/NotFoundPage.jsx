/**
 * StockPilot WMS - Not found page.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Link } from 'react-router-dom';

/**
 * Renders the 404 message for unknown client routes.
 *
 * @returns {JSX.Element} Page element.
 */
const NotFoundPage = () => (
  <section className="py-16 text-center">
    <h1 className="text-3xl font-semibold">Page not found</h1>
    <p className="mt-2 text-slate-600">The page you requested does not exist.</p>
    <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">
      Back to dashboard
    </Link>
  </section>
);

export default NotFoundPage;
