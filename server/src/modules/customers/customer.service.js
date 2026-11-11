/**
 * StockPilot WMS - Customer partner business logic.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Customer } from './customer.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists customers with filtering, search, and pagination.
 *
 * @param {object} query - Query parameters.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search keyword.
 * @param {boolean} [query.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated customers.
 */
export const listCustomers = async ({ page, limit, search, isActive }) => {
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
    Customer.find(filter).sort({ name: 1 }).skip(getSkip(page, limit)).limit(limit),
    Customer.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a customer by identifier.
 *
 * @param {string} id - Customer identifier.
 * @returns {Promise<object>} Customer document.
 * @throws {ApiError} When customer is not found.
 */
export const getCustomerById = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }
  return customer;
};

/**
 * Creates a new customer.
 *
 * @param {object} payload - Customer creation fields.
 * @returns {Promise<object>} Created customer.
 * @throws {ApiError} When duplicate customer code exists.
 */
export const createCustomer = async (payload) => {
  const existing = await Customer.findOne({ code: payload.code.toUpperCase() });
  if (existing) {
    throw ApiError.conflict('Customer with this code already exists');
  }

  return Customer.create({
    ...payload,
    code: payload.code.toUpperCase(),
  });
};

/**
 * Updates an existing customer.
 *
 * @param {string} id - Customer identifier.
 * @param {object} payload - Update fields.
 * @returns {Promise<object>} Updated customer.
 * @throws {ApiError} When customer is not found.
 */
export const updateCustomer = async (id, payload) => {
  const customer = await Customer.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }
  return customer;
};

/**
 * Deactivates a customer.
 *
 * @param {string} id - Customer identifier.
 * @returns {Promise<object>} Deactivated customer.
 */
export const deactivateCustomer = async (id) => updateCustomer(id, { isActive: false });
