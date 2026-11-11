/**
 * StockPilot WMS - User management business logic.
 *
 * Provides CRUD operations for users, enforces administrative safety guards,
 * and handles pagination and search.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import bcrypt from 'bcryptjs';
import { User } from './user.model.js';
import { ROLES } from '../auth/permissions.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Escapes characters for safe regular expression matching.
 *
 * @param {string} value - Raw search query.
 * @returns {string} Escaped string.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Lists users with filtering and pagination.
 *
 * @param {object} query - Validated query filter.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search term.
 * @param {string} [query.role] - User role filter.
 * @param {boolean} [query.isActive] - Active status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated user list.
 */
export const listUsers = async ({ page, limit, search, role, isActive }) => {
  const filter = {};

  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    User.find(filter).sort({ name: 1 }).skip(getSkip(page, limit)).limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Finds a user by identifier.
 *
 * @param {string} id - User identifier.
 * @returns {Promise<object>} User document.
 * @throws {ApiError} When user does not exist.
 */
export const getUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
};

/**
 * Creates a new user record.
 *
 * @param {object} payload - User creation fields.
 * @param {string} payload.name - User full name.
 * @param {string} payload.email - User email address.
 * @param {string} payload.password - Raw password.
 * @param {string} payload.role - Assigned role.
 * @param {string[]} [payload.warehouses] - Assigned warehouse identifiers.
 * @returns {Promise<object>} Created user.
 * @throws {ApiError} When email is already registered.
 */
export const createUser = async ({ name, email, password, role, warehouses = [] }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  return User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role,
    warehouses,
  });
};

/**
 * Updates an existing user record.
 *
 * @param {string} id - Target user identifier.
 * @param {object} payload - Update fields.
 * @param {string} currentUserId - Identifier of the acting administrator.
 * @returns {Promise<object>} Updated user.
 * @throws {ApiError} When self-demotion or self-deactivation is attempted.
 */
export const updateUser = async (id, payload, currentUserId) => {
  if (id === currentUserId) {
    if (payload.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }
    if (payload.role && payload.role !== ROLES.ADMIN) {
      throw ApiError.badRequest('You cannot demote your own account');
    }
  }

  const updated = await User.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!updated) {
    throw ApiError.notFound('User not found');
  }

  return updated;
};
