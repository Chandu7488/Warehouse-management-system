/**
 * StockPilot WMS - Money and currency conversion utilities.
 *
 * Provides safe conversions between major currency units and integer minor units,
 * preventing floating-point inaccuracies across financial transactions.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */

/**
 * Converts a major currency value to integer minor units.
 *
 * @param {number|string} amount - Major currency amount.
 * @param {number} [decimals=2] - Number of minor unit decimal places.
 * @returns {number} Integer minor units.
 */
export const toMinorUnits = (amount, decimals = 2) => {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Math.round(numeric * factor);
};

/**
 * Converts integer minor units back to a float major currency value.
 *
 * @param {number} minorAmount - Integer minor units.
 * @param {number} [decimals=2] - Number of decimal places.
 * @returns {number} Major currency floating-point number.
 */
export const toMajorUnits = (minorAmount, decimals = 2) => {
  if (!Number.isFinite(minorAmount)) {
    return 0;
  }
  const factor = 10 ** decimals;
  return Number((minorAmount / factor).toFixed(decimals));
};

/**
 * Formats integer minor units as a localized currency string.
 *
 * @param {number} minorAmount - Integer minor units.
 * @param {string} [currency='USD'] - ISO 4217 currency code.
 * @param {string} [locale='en-US'] - Formatting locale.
 * @returns {string} Formatted currency string.
 */
export const formatMoney = (minorAmount, currency = 'USD', locale = 'en-US') => {
  const major = toMajorUnits(minorAmount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(major);
};
