/**
 * StockPilot WMS - Warehouse site business logic.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Warehouse } from './warehouse.model.js';
import { ensureSystemLocations } from '../locations/location.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists warehouses with filtering, search, and pagination.
 *
 * @param {object} query - Query parameters.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search keyword.
 * @param {boolean} [query.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated warehouses.
 */
export const listWarehouses = async ({ page, limit, search, isActive }) => {
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
    Warehouse.find(filter).sort({ name: 1 }).skip(getSkip(page, limit)).limit(limit),
    Warehouse.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a warehouse by identifier.
 *
 * @param {string} id - Warehouse identifier.
 * @returns {Promise<object>} Warehouse document.
 * @throws {ApiError} When warehouse is not found.
 */
export const getWarehouseById = async (id) => {
  const warehouse = await Warehouse.findById(id);
  if (!warehouse) {
    throw ApiError.notFound('Warehouse not found');
  }
  return warehouse;
};

/**
 * Creates a new warehouse site.
 *
 * @param {object} payload - Warehouse creation fields.
 * @returns {Promise<object>} Created warehouse.
 * @throws {ApiError} When duplicate warehouse code exists.
 */
export const createWarehouse = async (payload) => {
  const existing = await Warehouse.findOne({ code: payload.code.toUpperCase() });
  if (existing) {
    throw ApiError.conflict('Warehouse with this code already exists');
  }

  const warehouse = await Warehouse.create({
    ...payload,
    code: payload.code.toUpperCase(),
  });

  await ensureSystemLocations(warehouse._id);

  return warehouse;
};

/**
 * Updates an existing warehouse site.
 *
 * @param {string} id - Warehouse identifier.
 * @param {object} payload - Update fields.
 * @returns {Promise<object>} Updated warehouse.
 * @throws {ApiError} When warehouse is not found.
 */
export const updateWarehouse = async (id, payload) => {
  const warehouse = await Warehouse.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!warehouse) {
    throw ApiError.notFound('Warehouse not found');
  }
  return warehouse;
};

/**
 * Deactivates a warehouse site.
 *
 * @param {string} id - Warehouse identifier.
 * @returns {Promise<object>} Deactivated warehouse.
 */
export const deactivateWarehouse = async (id) => updateWarehouse(id, { isActive: false });
