/**
 * StockPilot WMS - Serial Number HTTP Controller.
 *
 * Exposes endpoints for managing serialized items.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as serialService from './serial.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Handles serial number listing.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const listSerialsHandler = async (req, res) => {
  const { items, meta } = await serialService.listSerials(req.validated.query);
  return sendSuccess(res, {
    message: 'Serial numbers retrieved successfully',
    data: items,
    meta,
  });
};

/**
 * Handles retrieving a serial record by identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getSerialByIdHandler = async (req, res) => {
  const serial = await serialService.getSerialById(req.params.id);
  return sendSuccess(res, {
    message: 'Serial number retrieved successfully',
    data: serial,
  });
};

/**
 * Handles registering a new serial number.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const createSerialHandler = async (req, res) => {
  const serial = await serialService.createSerial(req.validated.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Serial number created successfully',
    data: serial,
  });
};
