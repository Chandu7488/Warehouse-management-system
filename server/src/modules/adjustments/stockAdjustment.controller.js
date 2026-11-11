/**
 * StockPilot WMS - Stock Adjustment Express Controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as adjustmentService from './stockAdjustment.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createAdjustmentHandler = async (req, res) => {
  const adj = await adjustmentService.createAdjustment(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Stock adjustment proposed successfully',
    data: adj,
  });
};

export const approveAdjustmentHandler = async (req, res) => {
  const adj = await adjustmentService.approveAdjustment(
    req.validated.params.id,
    req.validated.body,
    req.user,
  );
  return sendSuccess(res, {
    message: 'Stock adjustment approved and ledger movements posted',
    data: adj,
  });
};

export const rejectAdjustmentHandler = async (req, res) => {
  const adj = await adjustmentService.rejectAdjustment(
    req.validated.params.id,
    req.body.reason,
    req.user,
  );
  return sendSuccess(res, {
    message: 'Stock adjustment rejected',
    data: adj,
  });
};

export const getAdjustmentByIdHandler = async (req, res) => {
  const adj = await adjustmentService.getAdjustmentById(req.validated.params.id);
  return sendSuccess(res, {
    data: adj,
  });
};

export const listAdjustmentsHandler = async (req, res) => {
  const { page, limit, ...filters } = req.validated.query;
  const result = await adjustmentService.listAdjustments(filters, { page, limit });
  return sendSuccess(res, {
    data: result.items,
    meta: result.meta,
  });
};
