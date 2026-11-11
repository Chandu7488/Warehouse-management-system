/**
 * StockPilot WMS - Location HTTP controller.
 *
 * Translates HTTP requests into location domain service invocations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as locationService from './location.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

/**
 * Handles listing locations with filtering and pagination.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const listLocationsHandler = async (req, res) => {
  const { items, meta } = await locationService.listLocations(req.validated.query);
  return sendSuccess(res, { message: 'Locations retrieved successfully', data: items, meta });
};

/**
 * Handles fetching the hierarchical location tree for a warehouse.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getLocationTreeHandler = async (req, res) => {
  const tree = await locationService.getLocationTree(req.validated.query.warehouse);
  return sendSuccess(res, { message: 'Location tree retrieved successfully', data: tree });
};

/**
 * Handles retrieving a single location by its identifier.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const getLocationByIdHandler = async (req, res) => {
  const location = await locationService.getLocationById(req.validated.params.id);
  return sendSuccess(res, { message: 'Location retrieved successfully', data: location });
};

/**
 * Handles creating a single warehouse location.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const createLocationHandler = async (req, res) => {
  const location = await locationService.createLocation(req.validated.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Location created successfully',
    data: location,
  });
};

/**
 * Handles bulk generating a rack with shelves and bins.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const bulkCreateLocationsHandler = async (req, res) => {
  const result = await locationService.bulkCreateLocations(req.validated.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Locations generated successfully',
    data: result,
  });
};

/**
 * Handles updating an existing warehouse location.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const updateLocationHandler = async (req, res) => {
  const location = await locationService.updateLocation(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, { message: 'Location updated successfully', data: location });
};

/**
 * Handles deactivating an existing warehouse location.
 *
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<import('express').Response>}
 */
export const deactivateLocationHandler = async (req, res) => {
  const location = await locationService.deactivateLocation(req.validated.params.id);
  return sendSuccess(res, { message: 'Location deactivated successfully', data: location });
};
