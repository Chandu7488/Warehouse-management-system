/**
 * StockPilot WMS - Purchase Order Controller.
 *
 * Translates HTTP requests to purchase order domain service operations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as poService from './purchaseOrder.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createPurchaseOrderHandler = async (req, res) => {
  const po = await poService.createPurchaseOrder(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Purchase order created successfully',
    data: po,
  });
};

export const listPurchaseOrdersHandler = async (req, res) => {
  const result = await poService.listPurchaseOrders(req.validated.query);
  return sendSuccess(res, {
    message: 'Purchase orders retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getPurchaseOrderByIdHandler = async (req, res) => {
  const po = await poService.getPurchaseOrderById(req.params.id);
  return sendSuccess(res, {
    message: 'Purchase order retrieved successfully',
    data: po,
  });
};

export const updatePurchaseOrderHandler = async (req, res) => {
  const po = await poService.updatePurchaseOrder(req.params.id, req.validated.body);
  return sendSuccess(res, {
    message: 'Purchase order updated successfully',
    data: po,
  });
};

export const confirmPurchaseOrderHandler = async (req, res) => {
  const po = await poService.confirmPurchaseOrder(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Purchase order confirmed successfully',
    data: po,
  });
};

export const cancelPurchaseOrderHandler = async (req, res) => {
  const po = await poService.cancelPurchaseOrder(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Purchase order cancelled successfully',
    data: po,
  });
};
