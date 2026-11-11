/**
 * StockPilot WMS - Client money utilities.
 *
 * Provides safe conversions between minor currency units (cents/integers)
 * and display currency formatting.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */

/**
 * Formats minor currency units into a formatted currency string.
 *
 * @param {number|null|undefined} minorUnits - Amount in integer cents.
 * @param {string} [currency='USD'] - Currency ISO code.
 * @returns {string} Formatted currency string.
 */
export const formatMoney = (minorUnits, currency = 'USD') => {
  const amount = Number.isFinite(minorUnits) ? minorUnits / 100 : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Converts major currency units (e.g. 19.99) to minor integer units (1999).
 *
 * @param {number|string} majorUnits - Amount in major currency units.
 * @returns {number} Non-negative integer minor units.
 */
export const toMinorUnits = (majorUnits) => {
  const numeric = typeof majorUnits === 'string' ? parseFloat(majorUnits) : Number(majorUnits);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric * 100);
};

/**
 * Converts integer minor units to major float units.
 *
 * @param {number|null|undefined} minorUnits - Minor integer units.
 * @returns {number} Amount in major units.
 */
export const toMajorUnits = (minorUnits) => {
  if (!Number.isFinite(minorUnits)) {
    return 0;
  }
  return minorUnits / 100;
};
