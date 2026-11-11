/**
 * StockPilot WMS - Cycle Count Express Controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as cycleCountService from './cycleCount.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const createCycleCountHandler = async (req, res) => {
  const countDoc = await cycleCountService.createCycleCountPlan(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Cycle count plan created successfully',
    data: countDoc,
  });
};

export const startCycleCountHandler = async (req, res) => {
  const countDoc = await cycleCountService.startCycleCount(req.validated.params.id);
  return sendSuccess(res, {
    message: 'Cycle count started and inventory snapshot frozen',
    data: countDoc,
  });
};

export const submitCountResultsHandler = async (req, res) => {
  const countDoc = await cycleCountService.recordCountResults(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, {
    message: 'Physical counts recorded successfully',
    data: countDoc,
  });
};

export const requestRecountHandler = async (req, res) => {
  const countDoc = await cycleCountService.requestRecount(
    req.validated.params.id,
    req.validated.body,
  );
  return sendSuccess(res, {
    message: 'Recount requested for selected lines',
    data: countDoc,
  });
};

export const reconcileCycleCountHandler = async (req, res) => {
  const countDoc = await cycleCountService.reconcileCycleCount(
    req.validated.params.id,
    req.validated.body,
    req.user,
  );
  return sendSuccess(res, {
    message: 'Cycle count variances successfully reconciled into stock ledger',
    data: countDoc,
  });
};

export const cancelCycleCountHandler = async (req, res) => {
  const countDoc = await cycleCountService.cancelCycleCount(
    req.validated.params.id,
    req.body.reason,
  );
  return sendSuccess(res, {
    message: 'Cycle count session cancelled',
    data: countDoc,
  });
};

export const getCycleCountByIdHandler = async (req, res) => {
  const countDoc = await cycleCountService.getCycleCountById(req.validated.params.id);
  return sendSuccess(res, {
    data: countDoc,
  });
};

export const listCycleCountsHandler = async (req, res) => {
  const { page, limit, ...filters } = req.validated.query;
  const result = await cycleCountService.listCycleCounts(filters, { page, limit });
  return sendSuccess(res, {
    data: result.items,
    meta: result.meta,
  });
};
