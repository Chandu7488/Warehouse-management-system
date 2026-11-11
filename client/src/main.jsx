/**
 * StockPilot WMS - React entry point.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import App from '@/app/App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
