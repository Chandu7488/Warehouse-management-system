/**
 * StockPilot WMS - Transfers & Replenishment Controllers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import {
  executeDirectBinTransfer,
  createTransferOrder,
  listTransferOrders,
  getTransferOrderById,
  dispatchTransferOrder,
  receiveTransferOrder,
  cancelTransferOrder,
  upsertReplenishmentRule,
  listReplenishmentRules,
  evaluateReplenishmentNeeds,
} from './transferOrder.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const directBinTransferHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const result = await executeDirectBinTransfer(payload, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Direct bin transfer completed successfully',
    data: result,
  });
};

export const createTransferOrderHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const order = await createTransferOrder(payload, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Transfer order created successfully',
    data: order,
  });
};

export const listTransferOrdersHandler = async (req, res) => {
  const query = req.validated?.query ?? req.query;
  const { originWarehouse, destinationWarehouse, transferType, status, search, page, limit } = query;
  const result = await listTransferOrders(
    { originWarehouse, destinationWarehouse, transferType, status, search },
    { page, limit },
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Transfer orders retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getTransferOrderByIdHandler = async (req, res) => {
  const order = await getTransferOrderById(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Transfer order details retrieved successfully',
    data: order,
  });
};

export const dispatchTransferOrderHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const order = await dispatchTransferOrder(req.params.id, payload, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Transfer order dispatched successfully',
    data: order,
  });
};

export const receiveTransferOrderHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const order = await receiveTransferOrder(req.params.id, payload, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Transfer order received and stock deposited',
    data: order,
  });
};

export const cancelTransferOrderHandler = async (req, res) => {
  const order = await cancelTransferOrder(req.params.id, req.body?.reason, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Transfer order cancelled successfully',
    data: order,
  });
};

export const upsertReplenishmentRuleHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const rule = await upsertReplenishmentRule(payload, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Replenishment rule configured successfully',
    data: rule,
  });
};

export const listReplenishmentRulesHandler = async (req, res) => {
  const filters = {
    warehouse: req.query.warehouse,
    product: req.query.product,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
  };
  const rules = await listReplenishmentRules(filters);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Replenishment rules retrieved successfully',
    data: rules,
  });
};

export const evaluateReplenishmentNeedsHandler = async (req, res) => {
  const warehouseId = req.params.warehouseId || req.query.warehouse;
  const recommendations = await evaluateReplenishmentNeeds(warehouseId);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Replenishment needs evaluated successfully',
    data: recommendations,
  });
};
