/**
 * StockPilot WMS - Root application component.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { RouterProvider } from 'react-router-dom';
import AppProviders from '@/app/AppProviders.jsx';
import { router } from '@/app/router.jsx';

/**
 * Composes global providers with the application router.
 *
 * @returns {JSX.Element} The application tree.
 */
const App = () => (
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);

export default App;
