/**
 * StockPilot WMS - Serial Number business logic.
 *
 * Manages unique serialization, lookup, and status tracking for serialized products.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Serial } from './serial.model.js';
import { Product, TRACKING_TYPES } from '../products/product.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

/**
 * Lists serial records with optional filtering.
 *
 * @param {object} query - Query parameters.
 * @returns {Promise<{items: object[], meta: object}>} Paginated serials.
 */
export const listSerials = async (query = {}) => {
  const { product, status, warehouse, location, page = 1, limit = 20 } = query;
  const filter = {};

  if (product) {
    filter.product = product;
  }
  if (status) {
    filter.status = status;
  }
  if (warehouse) {
    filter.warehouse = warehouse;
  }
  if (location) {
    filter.location = location;
  }

  const [items, total] = await Promise.all([
    Serial.find(filter)
      .populate('product', 'sku name tracking')
      .populate('warehouse', 'name code')
      .populate('location', 'path code type')
      .populate('batch', 'batchNumber expiresOn')
      .sort({ createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    Serial.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Retrieves a single serial record by its identifier.
 *
 * @param {string} id - Serial record identifier.
 * @returns {Promise<object>} Serial document.
 * @throws {ApiError} When serial is not found.
 */
export const getSerialById = async (id) => {
  const serial = await Serial.findById(id)
    .populate('product', 'sku name tracking')
    .populate('warehouse', 'name code')
    .populate('location', 'path code type')
    .populate('batch', 'batchNumber expiresOn');

  if (!serial) {
    throw ApiError.notFound('Serial number not found');
  }
  return serial;
};

/**
 * Creates a new serial record for a serial-tracked product.
 *
 * @param {object} payload - Serial creation parameters.
 * @returns {Promise<object>} Created serial document.
 * @throws {ApiError} When product is not serial-tracked or serial already exists.
 */
export const createSerial = async (payload) => {
  const { product: productId, serialNumber, warehouse, location, batch } = payload;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw ApiError.unprocessable('Product not found or inactive');
  }

  const trackingType = product.trackingType || product.tracking;
  if (trackingType !== TRACKING_TYPES.SERIAL) {
    throw ApiError.badRequest(`Product ${product.sku} is not configured for serial tracking`);
  }

  const existing = await Serial.findOne({
    product: productId,
    serialNumber: serialNumber.toUpperCase().trim(),
  });

  if (existing) {
    throw ApiError.conflict(`Serial ${serialNumber} already exists for product ${product.sku}`);
  }

  return Serial.create({
    product: productId,
    serialNumber: serialNumber.toUpperCase().trim(),
    warehouse: warehouse || null,
    location: location || null,
    batch: batch || null,
  });
};
