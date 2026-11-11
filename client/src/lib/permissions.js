/**
 * StockPilot WMS - Client permission helpers.
 *
 * Provides permission constants and role evaluation helpers for conditional
 * UI rendering and route protection.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */

export const PERMISSIONS = Object.freeze({
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  MASTER_READ: 'master:read',
  MASTER_WRITE: 'master:write',
  PARTNERS_READ: 'partners:read',
  PARTNERS_WRITE: 'partners:write',
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_WRITE: 'warehouses:write',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  INVENTORY_OPENING: 'inventory:opening',
  INVENTORY_REVERSE: 'inventory:reverse',
  PURCHASING_READ: 'purchasing:read',
  PURCHASING_WRITE: 'purchasing:write',
  RECEIVING_READ: 'receiving:read',
  RECEIVING_WRITE: 'receiving:write',
  ORDERS_READ: 'orders:read',
  ORDERS_WRITE: 'orders:write',
  RETURNS_READ: 'returns:read',
  RETURNS_WRITE: 'returns:write',
  PICKING_READ: 'picking:read',
  PICKING_WRITE: 'picking:write',
  SHIPPING_READ: 'shipping:read',
  SHIPPING_WRITE: 'shipping:write',
  TRANSFERS_READ: 'transfers:read',
  TRANSFERS_WRITE: 'transfers:write',
  COUNTS_READ: 'counts:read',
  COUNTS_WRITE: 'counts:write',
  COUNTS_APPROVE: 'counts:approve',
  ADJUSTMENTS_READ: 'adjustments:read',
  ADJUSTMENTS_WRITE: 'adjustments:write',
  ADJUSTMENTS_APPROVE: 'adjustments:approve',
  REPORTS_READ: 'reports:read',
  AUDIT_READ: 'audit:read',
});

/**
 * Determines whether a user record possesses a specific permission.
 *
 * @param {object|null} user - Current user object.
 * @param {string} permission - Required permission string.
 * @returns {boolean} True if the user has permission.
 */
export const can = (user, permission) => {
  if (!user || !user.permissions) {
    return false;
  }
  return user.permissions.includes(permission);
};
