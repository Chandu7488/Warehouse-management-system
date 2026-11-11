/**
 * StockPilot WMS - Category business logic.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Category } from './category.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';
import { hasActiveProductsForCategory } from '../products/product.service.js';

const COLLATION = { locale: 'en', strength: 2 };

/**
 * Escapes user input so it can be used safely inside a regular expression.
 *
 * @param {string} value - Raw user input.
 * @returns {string} Escaped string.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists categories with filtering and pagination.
 *
 * @param {{page: number, limit: number, search?: string, isActive?: boolean}} query - Validated query.
 * @returns {Promise<{items: object[], meta: object}>} Page of categories and pagination metadata.
 */
export const listCategories = async ({ page, limit, search, isActive }) => {
  const filter = {};
  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' };
  }
  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }
  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ name: 1 })
      .skip(getSkip(page, limit))
      .limit(limit)
      .collation(COLLATION),
    Category.countDocuments(filter),
  ]);
  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a category by identifier.
 *
 * @param {string} id - Category identifier.
 * @returns {Promise<object>} The category document.
 * @throws {ApiError} When the category does not exist.
 */
export const getCategoryById = async (id) => {
  const category = await Category.findById(id);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  return category;
};

/**
 * Creates a category.
 *
 * @param {{name: string, description?: string}} payload - Validated body.
 * @returns {Promise<object>} The created category.
 * @throws {ApiError} When a category with the same name exists.
 */
export const createCategory = async (payload) => Category.create(payload);

/**
 * Updates a category.
 *
 * @param {string} id - Category identifier.
 * @param {{name?: string, description?: string, isActive?: boolean}} payload - Validated body.
 * @returns {Promise<object>} The updated category.
 * @throws {ApiError} When the category does not exist.
 */
export const updateCategory = async (id, payload) => {
  const category = await Category.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!category) {
    throw ApiError.notFound('Category not found');
  }
  return category;
};

/**
 * Deactivates a category. Categories are never physically deleted.
 *
 * @param {string} id - Category identifier.
 * @returns {Promise<object>} The deactivated category.
 * @throws {ApiError} When the category does not exist or is referenced by active products.
 */
export const deactivateCategory = async (id) => {
  const inUse = await hasActiveProductsForCategory(id);
  if (inUse) {
    throw ApiError.conflict('Cannot deactivate category: referenced by active products');
  }
  return updateCategory(id, { isActive: false });
};
