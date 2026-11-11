/**
 * StockPilot WMS - Product business logic.
 *
 * Manages product lifecycle, inventory tracking policies, pricing in minor units,
 * and decimal constraints enforced by the associated unit of measure.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Product, TRACKING_TYPES } from './product.model.js';
import { getCategoryById } from '../categories/category.service.js';
import { getUnitById } from '../units/unit.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';
import { getProductStockDetails } from '../inventory/inventory.service.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Checks whether any active product is linked to a unit of measure.
 *
 * @param {string} unitId - Unit identifier.
 * @returns {Promise<boolean>} True if referenced by active products.
 */
export const hasActiveProductsForUnit = async (unitId) => {
  const exists = await Product.exists({ unit: unitId, isActive: true });
  return Boolean(exists);
};

/**
 * Checks whether any active product is linked to a category.
 *
 * @param {string} categoryId - Category identifier.
 * @returns {Promise<boolean>} True if referenced by active products.
 */
export const hasActiveProductsForCategory = async (categoryId) => {
  const exists = await Product.exists({ category: categoryId, isActive: true });
  return Boolean(exists);
};

/**
 * Validates that fractional reorder quantities are disallowed when the unit requires whole units.
 *
 * @param {object} unit - Unit document.
 * @param {number} [reorderLevel] - Reorder threshold.
 * @param {number} [reorderQuantity] - Suggested reorder amount.
 * @returns {void}
 * @throws {ApiError} When fractional quantity is supplied for a non-decimal unit.
 */
const validateUnitDecimals = (unit, reorderLevel, reorderQuantity) => {
  if (!unit.allowDecimals) {
    if (reorderLevel !== undefined && !Number.isInteger(reorderLevel)) {
      throw ApiError.badRequest(
        `Unit ${unit.code} does not allow fractional values for reorderLevel`,
      );
    }
    if (reorderQuantity !== undefined && !Number.isInteger(reorderQuantity)) {
      throw ApiError.badRequest(
        `Unit ${unit.code} does not allow fractional values for reorderQuantity`,
      );
    }
  }
};

/**
 * Lists products with filtering, search, and pagination.
 *
 * @param {object} query - Query parameters.
 * @param {number} query.page - Page number.
 * @param {number} query.limit - Page size.
 * @param {string} [query.search] - Search keyword.
 * @param {string} [query.category] - Category identifier.
 * @param {string} [query.unit] - Unit identifier.
 * @param {string} [query.trackingType] - Tracking type.
 * @param {boolean} [query.isActive] - Status filter.
 * @returns {Promise<{items: object[], meta: object}>} Paginated product list.
 */
export const listProducts = async ({
  page,
  limit,
  search,
  category,
  unit,
  trackingType,
  isActive,
}) => {
  const filter = {};

  if (search) {
    const escaped = escapeRegex(search);
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { sku: { $regex: escaped, $options: 'i' } },
      { barcode: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = category;
  }
  if (unit) {
    filter.unit = unit;
  }
  if (trackingType) {
    filter.trackingType = trackingType;
  }
  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name')
      .populate('unit', 'code name allowDecimals')
      .sort({ sku: 1 })
      .skip(getSkip(page, limit))
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page, limit, total }) };
};

/**
 * Retrieves a single product by identifier with populated relationships.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object>} Product document.
 * @throws {ApiError} When product is not found.
 */
export const getProductById = async (id) => {
  const product = await Product.findById(id)
    .populate('category', 'name')
    .populate('unit', 'code name allowDecimals');
  if (!product) {
    throw ApiError.notFound('Product not found');
  }
  return product;
};

/**
 * Creates a new product.
 *
 * @param {object} payload - Product creation payload.
 * @returns {Promise<object>} Created product.
 * @throws {ApiError} When validation fails or duplicate SKU/barcode exists.
 */
export const createProduct = async (payload) => {
  const existingSku = await Product.findOne({ sku: payload.sku.toUpperCase() });
  if (existingSku) {
    throw ApiError.conflict('Product with this SKU already exists');
  }

  if (payload.barcode) {
    const existingBarcode = await Product.findOne({ barcode: payload.barcode });
    if (existingBarcode) {
      throw ApiError.conflict('Product with this barcode already exists');
    }
  }

  const category = await getCategoryById(payload.category);
  if (!category.isActive) {
    throw ApiError.badRequest('Referenced category is inactive');
  }

  const unit = await getUnitById(payload.unit);
  if (!unit.isActive) {
    throw ApiError.badRequest('Referenced unit is inactive');
  }

  validateUnitDecimals(unit, payload.reorderLevel, payload.reorderQuantity);

  if (payload.hasExpiry && payload.trackingType !== TRACKING_TYPES.BATCH) {
    throw ApiError.badRequest('Expiry tracking is only permitted for BATCH tracked products');
  }

  return Product.create({
    ...payload,
    sku: payload.sku.toUpperCase(),
  });
};

/**
 * Updates an existing product.
 *
 * @param {string} id - Product identifier.
 * @param {object} payload - Update payload.
 * @returns {Promise<object>} Updated product.
 * @throws {ApiError} When product is not found or constraints fail.
 */
export const updateProduct = async (id, payload) => {
  const product = await Product.findById(id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  if (payload.unit) {
    const unit = await getUnitById(payload.unit);
    if (!unit.isActive) {
      throw ApiError.badRequest('Referenced unit is inactive');
    }
    const rLevel = payload.reorderLevel ?? product.reorderLevel;
    const rQty = payload.reorderQuantity ?? product.reorderQuantity;
    validateUnitDecimals(unit, rLevel, rQty);
  } else if (payload.reorderLevel !== undefined || payload.reorderQuantity !== undefined) {
    const unit = await getUnitById(product.unit);
    validateUnitDecimals(
      unit,
      payload.reorderLevel ?? product.reorderLevel,
      payload.reorderQuantity ?? product.reorderQuantity,
    );
  }

  if (payload.category) {
    const category = await getCategoryById(payload.category);
    if (!category.isActive) {
      throw ApiError.badRequest('Referenced category is inactive');
    }
  }

  const updated = await Product.findByIdAndUpdate(id, payload, {
    returnDocument: 'after',
    runValidators: true,
  })
    .populate('category', 'name')
    .populate('unit', 'code name allowDecimals');

  return updated;
};

/**
 * Deactivates a product.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object>} Deactivated product.
 */
export const deactivateProduct = async (id) => updateProduct(id, { isActive: false });

/**
 * Retrieves current stock balances for a product.
 *
 * @param {string} id - Product identifier.
 * @returns {Promise<object[]>} List of stock balances with location and batch details.
 */
export const getProductStock = async (id) => {
  await getProductById(id);
  return getProductStockDetails(id);
};

/**
 * Looks up an active product by exact barcode or SKU.
 *
 * @param {string} code - Barcode or SKU string.
 * @returns {Promise<object>} Matching product document.
 */
export const lookupProductByCode = async (code) => {
  if (!code || typeof code !== 'string') {
    throw ApiError.badRequest('Barcode or SKU code is required');
  }
  const trimmed = code.trim();
  const escaped = escapeRegex(trimmed);
  const product = await Product.findOne({
    $or: [
      { sku: new RegExp(`^${escaped}$`, 'i') },
      { barcode: trimmed },
    ],
    isActive: true,
  })
    .populate('category', 'name code')
    .populate('unit', 'code name symbol allowDecimals');

  if (!product) {
    throw ApiError.notFound(`No active product found matching code "${trimmed}"`);
  }
  return product;
};
