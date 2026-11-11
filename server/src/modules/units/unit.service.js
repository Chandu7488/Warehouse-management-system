/**
 * StockPilot WMS - Unit of measure business logic.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Unit } from './unit.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';
import { hasActiveProductsForUnit } from '../products/product.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists units of measure with filtering and pagination.
 *
 * @param {object} query - Query parameters.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search keyword.
 * @param {boolean} [query.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated units.
 */
export const listUnits = async ({ page, limit, search, isActive }) => {
  const filter = {};
  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
    ];
  }
  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    Unit.find(filter).sort({ code: 1 }).skip(getSkip(page, limit)).limit(limit),
    Unit.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a unit of measure by identifier.
 *
 * @param {string} id - Unit identifier.
 * @returns {Promise<object>} Unit document.
 * @throws {ApiError} When unit does not exist.
 */
export const getUnitById = async (id) => {
  const unit = await Unit.findById(id);
  if (!unit) {
    throw ApiError.notFound('Unit not found');
  }
  return unit;
};

/**
 * Creates a unit of measure.
 *
 * @param {object} payload - Unit fields.
 * @returns {Promise<object>} Created unit.
 * @throws {ApiError} When a unit with the same code exists.
 */
export const createUnit = async (payload) => {
  const existing = await Unit.findOne({ code: payload.code.toUpperCase() });
  if (existing) {
    throw ApiError.conflict('Unit with this code already exists');
  }
  return Unit.create({
    ...payload,
    code: payload.code.toUpperCase(),
  });
};

/**
 * Updates a unit of measure.
 *
 * @param {string} id - Unit identifier.
 * @param {object} payload - Update fields.
 * @returns {Promise<object>} Updated unit.
 * @throws {ApiError} When unit is not found.
 */
export const updateUnit = async (id, payload) => {
  const unit = await Unit.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!unit) {
    throw ApiError.notFound('Unit not found');
  }
  return unit;
};

/**
 * Deactivates a unit of measure if no active products are referencing it.
 *
 * @param {string} id - Unit identifier.
 * @returns {Promise<object>} Deactivated unit.
 * @throws {ApiError} When unit is in use or not found.
 */
export const deactivateUnit = async (id) => {
  const inUse = await hasActiveProductsForUnit(id);
  if (inUse) {
    throw ApiError.conflict('Cannot deactivate unit: referenced by active products');
  }
  return updateUnit(id, { isActive: false });
};
