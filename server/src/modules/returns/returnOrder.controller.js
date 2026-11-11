/**
 * StockPilot WMS - Return Order / RMA Controllers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import {
  createReturnOrder,
  listReturnOrders,
  getReturnOrderById,
  receiveReturnOrder,
  processDisposition,
  cancelReturnOrder,
} from './returnOrder.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createReturnOrderHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const returnOrder = await createReturnOrder(payload, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Return Order created successfully',
    data: returnOrder,
  });
};

export const listReturnOrdersHandler = async (req, res) => {
  const query = req.validated?.query ?? req.query;
  const { warehouse, returnType, status, customer, supplier, search, page, limit } = query;
  const result = await listReturnOrders(
    { warehouse, returnType, status, customer, supplier, search },
    { page, limit },
  );
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Return Orders retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getReturnOrderByIdHandler = async (req, res) => {
  const returnOrder = await getReturnOrderById(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Return Order details retrieved successfully',
    data: returnOrder,
  });
};

export const receiveReturnOrderHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const returnOrder = await receiveReturnOrder(req.params.id, payload);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Return Order received at dock',
    data: returnOrder,
  });
};

export const processDispositionHandler = async (req, res) => {
  const payload = req.validated?.body ?? req.body;
  const returnOrder = await processDisposition(req.params.id, payload, req.user);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Disposition processed and stock ledger updated',
    data: returnOrder,
  });
};

export const cancelReturnOrderHandler = async (req, res) => {
  const returnOrder = await cancelReturnOrder(req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Return Order cancelled',
    data: returnOrder,
  });
};
