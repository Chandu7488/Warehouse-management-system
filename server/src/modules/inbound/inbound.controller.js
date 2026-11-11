/**
 * StockPilot WMS - Inbound Operations Controller.
 *
 * Translates HTTP requests for Goods Receipts and Directed Putaway tasks.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as grnService from './goodsReceipt.service.js';
import * as putawayService from './putaway.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createGoodsReceiptHandler = async (req, res) => {
  const grn = await grnService.createGoodsReceipt(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Goods receipt posted successfully and putaway tasks created',
    data: grn,
  });
};

export const listGoodsReceiptsHandler = async (req, res) => {
  const result = await grnService.listGoodsReceipts(req.validated.query);
  return sendSuccess(res, {
    message: 'Goods receipts retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getGoodsReceiptByIdHandler = async (req, res) => {
  const grn = await grnService.getGoodsReceiptById(req.params.id);
  return sendSuccess(res, {
    message: 'Goods receipt retrieved successfully',
    data: grn,
  });
};

export const listPutawayTasksHandler = async (req, res) => {
  const result = await putawayService.listPutawayTasks(req.validated.query);
  return sendSuccess(res, {
    message: 'Putaway tasks retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const suggestPutawayLocationHandler = async (req, res) => {
  const location = await putawayService.suggestPutawayLocation({
    warehouseId: req.validated.query.warehouse,
    productId: req.validated.query.product,
    batchId: req.validated.query.batch || null,
  });
  return sendSuccess(res, {
    message: 'Suggested putaway location determined successfully',
    data: location,
  });
};

export const getPutawayTaskByIdHandler = async (req, res) => {
  const task = await putawayService.getPutawayTaskById(req.params.id);
  return sendSuccess(res, {
    message: 'Putaway task retrieved successfully',
    data: task,
  });
};

export const completePutawayTaskHandler = async (req, res) => {
  const task = await putawayService.completePutawayTask({
    taskId: req.params.id,
    destinationLocationId: req.validated.body.destinationLocation,
    notes: req.validated.body.notes,
    actor: req.user,
  });
  return sendSuccess(res, {
    message: 'Putaway task completed and inventory transferred successfully',
    data: task,
  });
};

export const cancelPutawayTaskHandler = async (req, res) => {
  const task = await putawayService.cancelPutawayTask({
    taskId: req.params.id,
    actor: req.user,
  });
  return sendSuccess(res, {
    message: 'Putaway task cancelled successfully',
    data: task,
  });
};
