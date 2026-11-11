/**
 * StockPilot WMS - Analytics & Reports Express Controller.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import {
  getDashboardAnalytics,
  getInventoryValuationReport,
  getInventoryTurnoverReport,
  getBatchAgingReport,
  getDiscrepancyReport,
  exportReportToCsv,
} from './reports.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

export const getDashboardAnalyticsHandler = async (req, res, next) => {
  try {
    const data = await getDashboardAnalytics(req.query.warehouse);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Dashboard analytics fetched',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getInventoryValuationReportHandler = async (req, res, next) => {
  try {
    const data = await getInventoryValuationReport(req.query);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Inventory valuation report fetched',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getInventoryTurnoverReportHandler = async (req, res, next) => {
  try {
    const data = await getInventoryTurnoverReport(req.query);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Inventory turnover report fetched',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getBatchAgingReportHandler = async (req, res, next) => {
  try {
    const data = await getBatchAgingReport(req.query);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Batch shelf-life aging report fetched',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getDiscrepancyReportHandler = async (req, res, next) => {
  try {
    const data = await getDiscrepancyReport(req.query);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Discrepancy and shrinkage report fetched',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const exportReportToCsvHandler = async (req, res, next) => {
  try {
    const { reportType } = req.params;
    const csvContent = await exportReportToCsv(reportType, req.query);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `stockpilot-${reportType}-report-${timestamp}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return next(err);
  }
};
