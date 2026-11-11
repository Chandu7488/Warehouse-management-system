/**
 * StockPilot WMS - Client route definitions.
 *
 * Configures application routes, authentication guards, and role permissions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from '@/app/ProtectedRoute.jsx';
import AppLayout from '@/layouts/AppLayout.jsx';
import LoginPage from '@/features/auth/pages/LoginPage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import UsersPage from '@/features/users/pages/UsersPage.jsx';
import CategoriesPage from '@/features/categories/pages/CategoriesPage.jsx';
import UnitsPage from '@/features/units/pages/UnitsPage.jsx';
import ProductsPage from '@/features/products/pages/ProductsPage.jsx';
import SuppliersPage from '@/features/suppliers/pages/SuppliersPage.jsx';
import CustomersPage from '@/features/customers/pages/CustomersPage.jsx';
import WarehousesPage from '@/features/warehouses/pages/WarehousesPage.jsx';
import WarehouseLocationsPage from '@/features/locations/pages/WarehouseLocationsPage.jsx';
import StockOverviewPage from '@/features/inventory/pages/StockOverviewPage.jsx';
import StockLedgerPage from '@/features/inventory/pages/StockLedgerPage.jsx';
import PurchaseOrdersPage from '@/features/purchasing/pages/PurchaseOrdersPage.jsx';
import GoodsReceiptsPage from '@/features/inbound/pages/GoodsReceiptsPage.jsx';
import PutawayTasksPage from '@/features/inbound/pages/PutawayTasksPage.jsx';
import SalesOrdersPage from '@/features/outbound/pages/SalesOrdersPage.jsx';
import PickListsPage from '@/features/outbound/pages/PickListsPage.jsx';
import ShipmentsPage from '@/features/outbound/pages/ShipmentsPage.jsx';
import ReturnsPage from '@/features/returns/pages/ReturnsPage.jsx';
import TransfersPage from '@/features/transfers/pages/TransfersPage.jsx';
import ReplenishmentPage from '@/features/transfers/pages/ReplenishmentPage.jsx';
import CycleCountsPage from '@/features/counts/pages/CycleCountsPage.jsx';
import CountSessionDetailPage from '@/features/counts/pages/CountSessionDetailPage.jsx';
import StockAdjustmentsPage from '@/features/adjustments/pages/StockAdjustmentsPage.jsx';
import ReportsPage from '@/features/reports/pages/ReportsPage.jsx';
import ForbiddenPage from '@/pages/ForbiddenPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';
import ErrorPage from '@/pages/ErrorPage.jsx';
import { PERMISSIONS } from '@/lib/permissions.js';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'products',
        element: (
          <ProtectedRoute permission={PERMISSIONS.MASTER_READ}>
            <ProductsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'categories',
        element: (
          <ProtectedRoute permission={PERMISSIONS.MASTER_READ}>
            <CategoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'units',
        element: (
          <ProtectedRoute permission={PERMISSIONS.MASTER_READ}>
            <UnitsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <ProtectedRoute permission={PERMISSIONS.PARTNERS_READ}>
            <SuppliersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'customers',
        element: (
          <ProtectedRoute permission={PERMISSIONS.PARTNERS_READ}>
            <CustomersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'warehouses',
        element: (
          <ProtectedRoute permission={PERMISSIONS.WAREHOUSES_READ}>
            <WarehousesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'warehouses/:warehouseId/locations',
        element: (
          <ProtectedRoute permission={PERMISSIONS.WAREHOUSES_READ}>
            <WarehouseLocationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'locations',
        element: (
          <ProtectedRoute permission={PERMISSIONS.WAREHOUSES_READ}>
            <WarehouseLocationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory',
        element: (
          <ProtectedRoute permission={PERMISSIONS.INVENTORY_READ}>
            <StockOverviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inventory/ledger',
        element: (
          <ProtectedRoute permission={PERMISSIONS.INVENTORY_READ}>
            <StockLedgerPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'purchasing/orders',
        element: (
          <ProtectedRoute permission={PERMISSIONS.PURCHASING_READ}>
            <PurchaseOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inbound/receipts',
        element: (
          <ProtectedRoute permission={PERMISSIONS.RECEIVING_READ}>
            <GoodsReceiptsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'inbound/putaway',
        element: (
          <ProtectedRoute permission={PERMISSIONS.RECEIVING_READ}>
            <PutawayTasksPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'outbound/orders',
        element: (
          <ProtectedRoute permission={PERMISSIONS.ORDERS_READ}>
            <SalesOrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'outbound/picking',
        element: (
          <ProtectedRoute permission={PERMISSIONS.PICKING_READ}>
            <PickListsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'outbound/shipments',
        element: (
          <ProtectedRoute permission={PERMISSIONS.SHIPPING_READ}>
            <ShipmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'returns',
        element: (
          <ProtectedRoute permission={PERMISSIONS.RETURNS_READ}>
            <ReturnsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transfers',
        element: (
          <ProtectedRoute permission={PERMISSIONS.TRANSFERS_READ}>
            <TransfersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'transfers/replenishment',
        element: (
          <ProtectedRoute permission={PERMISSIONS.TRANSFERS_READ}>
            <ReplenishmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'counts',
        element: (
          <ProtectedRoute permission={PERMISSIONS.COUNTS_READ}>
            <CycleCountsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'counts/:id',
        element: (
          <ProtectedRoute permission={PERMISSIONS.COUNTS_READ}>
            <CountSessionDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'adjustments',
        element: (
          <ProtectedRoute permission={PERMISSIONS.ADJUSTMENTS_READ}>
            <StockAdjustmentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute permission={PERMISSIONS.REPORTS_READ}>
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <ProtectedRoute permission={PERMISSIONS.USERS_READ}>
            <UsersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'forbidden',
        element: <ForbiddenPage />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
