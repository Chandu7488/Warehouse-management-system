/**
 * StockPilot WMS - Batch HTTP Controller.
 *
 * Exposes endpoints for managing batches and expiration tracking.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as batchService from './batch.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Handles batch listing and filtering.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const listBatchesHandler = async (req, res) => {
  const { items, meta } = await batchService.listBatches(req.validated.query);
  return sendSuccess(res, {
    message: 'Batches retrieved successfully',
    data: items,
    meta,
  });
};

/**
 * Handles retrieving a batch by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getBatchByIdHandler = async (req, res) => {
  const batch = await batchService.getBatchById(req.params.id);
  return sendSuccess(res, {
    message: 'Batch retrieved successfully',
    data: batch,
  });
};

/**
 * Handles creating a batch record.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const createBatchHandler = async (req, res) => {
  const batch = await batchService.createBatch(req.validated.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Batch created successfully',
    data: batch,
  });
};

/**
 * Handles updating a batch status.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const updateBatchStatusHandler = async (req, res) => {
  const batch = await batchService.updateBatchStatus(req.params.id, req.validated.body.status);
  return sendSuccess(res, {
    message: 'Batch status updated successfully',
    data: batch,
  });
};
