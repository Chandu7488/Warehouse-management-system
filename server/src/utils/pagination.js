/**
 * StockPilot WMS - Pagination helpers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Calculates the number of documents to skip for a page.
 *
 * @param {number} page - One-based page number.
 * @param {number} limit - Page size.
 * @returns {number} Number of documents to skip.
 */
export const getSkip = (page, limit) => (page - 1) * limit;

/**
 * Builds pagination metadata for list responses.
 *
 * @param {object} options - Pagination inputs.
 * @param {number} options.page - Current one-based page number.
 * @param {number} options.limit - Page size.
 * @param {number} options.total - Total matching documents.
 * @returns {{page: number, limit: number, total: number, totalPages: number}} Pagination metadata.
 */
export const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
