/**
 * StockPilot WMS - Supplier partner business logic.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Supplier } from './supplier.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists suppliers with filtering, search, and pagination.
 *
 * @param {object} query - Query parameters.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search keyword.
 * @param {boolean} [query.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated suppliers.
 */
export const listSuppliers = async ({ page, limit, search, isActive }) => {
  const filter = {};

  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(getSkip(page, limit)).limit(limit),
    Supplier.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a supplier by identifier.
 *
 * @param {string} id - Supplier identifier.
 * @returns {Promise<object>} Supplier document.
 * @throws {ApiError} When supplier is not found.
 */
export const getSupplierById = async (id) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }
  return supplier;
};

/**
 * Creates a new supplier.
 *
 * @param {object} payload - Supplier creation fields.
 * @returns {Promise<object>} Created supplier.
 * @throws {ApiError} When duplicate supplier code exists.
 */
export const createSupplier = async (payload) => {
  const existing = await Supplier.findOne({ code: payload.code.toUpperCase() });
  if (existing) {
    throw ApiError.conflict('Supplier with this code already exists');
  }

  return Supplier.create({
    ...payload,
    code: payload.code.toUpperCase(),
  });
};

/**
 * Updates an existing supplier.
 *
 * @param {string} id - Supplier identifier.
 * @param {object} payload - Update fields.
 * @returns {Promise<object>} Updated supplier.
 * @throws {ApiError} When supplier is not found.
 */
export const updateSupplier = async (id, payload) => {
  const supplier = await Supplier.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }
  return supplier;
};

/**
 * Deactivates a supplier.
 *
 * @param {string} id - Supplier identifier.
 * @returns {Promise<object>} Deactivated supplier.
 */
export const deactivateSupplier = async (id) => updateSupplier(id, { isActive: false });
