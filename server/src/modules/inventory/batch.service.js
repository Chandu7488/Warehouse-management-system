/**
 * StockPilot WMS - Batch / Lot business logic.
 *
 * Manages lot lifecycle, expiration dates, and lot quarantine/recall states.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Batch } from './batch.model.js';
import { Product, TRACKING_TYPES } from '../products/product.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

/**
 * Lists batches with optional filtering by product, status, or supplier.
 *
 * @param {object} query - Query filter parameters.
 * @returns {Promise<{items: object[], meta: object}>} Paginated batches.
 */
export const listBatches = async (query = {}) => {
  const { product, status, supplier, page = 1, limit = 20 } = query;
  const filter = {};

  if (product) {
    filter.product = product;
  }
  if (status) {
    filter.status = status;
  }
  if (supplier) {
    filter.supplier = supplier;
  }

  const [items, total] = await Promise.all([
    Batch.find(filter)
      .populate('product', 'sku name tracking hasExpiry')
      .populate('supplier', 'name code')
      .sort({ expiresOn: 1, createdAt: -1 })
      .skip(getSkip(page, limit))
      .limit(Number(limit)),
    Batch.countDocuments(filter),
  ]);

  return {
    items,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Retrieves a single batch by its identifier.
 *
 * @param {string} id - Batch identifier.
 * @returns {Promise<object>} Batch document.
 * @throws {ApiError} When batch is not found.
 */
export const getBatchById = async (id) => {
  const batch = await Batch.findById(id)
    .populate('product', 'sku name tracking hasExpiry')
    .populate('supplier', 'name code');

  if (!batch) {
    throw ApiError.notFound('Batch not found');
  }
  return batch;
};

/**
 * Creates a new batch record for a batch-tracked product.
 *
 * @param {object} payload - Batch creation parameters.
 * @returns {Promise<object>} Created batch document.
 * @throws {ApiError} When product is not batch-tracked or batch number exists.
 */
export const createBatch = async (payload) => {
  const { product: productId, batchNumber, manufacturedOn, expiresOn, supplier } = payload;

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    throw ApiError.unprocessable('Product not found or inactive');
  }

  const trackingType = product.trackingType || product.tracking;
  if (trackingType !== TRACKING_TYPES.BATCH) {
    throw ApiError.badRequest(`Product ${product.sku} is not configured for batch tracking`);
  }

  if (product.hasExpiry && !expiresOn) {
    throw ApiError.badRequest(`Expiration date is required for product ${product.sku}`);
  }

  const existing = await Batch.findOne({
    product: productId,
    batchNumber: batchNumber.toUpperCase().trim(),
  });

  if (existing) {
    throw ApiError.conflict(`Batch ${batchNumber} already exists for product ${product.sku}`);
  }

  return Batch.create({
    product: productId,
    batchNumber: batchNumber.toUpperCase().trim(),
    manufacturedOn: manufacturedOn ? new Date(manufacturedOn) : null,
    expiresOn: expiresOn ? new Date(expiresOn) : null,
    supplier: supplier || null,
  });
};

/**
 * Updates the lifecycle status of a batch.
 *
 * @param {string} id - Batch identifier.
 * @param {string} status - New batch status.
 * @returns {Promise<object>} Updated batch document.
 * @throws {ApiError} When batch is not found.
 */
export const updateBatchStatus = async (id, status) => {
  const batch = await Batch.findById(id);
  if (!batch) {
    throw ApiError.notFound('Batch not found');
  }

  batch.status = status;
  await batch.save();
  return batch;
};
