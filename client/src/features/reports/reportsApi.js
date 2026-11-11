/**
 * StockPilot WMS - Analytics & Reports API Client.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { apiClient } from '@/lib/apiClient.js';

/**
 * Fetches executive dashboard KPIs and aggregated metrics.
 *
 * @param {object} [params={}] - Query filters (e.g., warehouse).
 * @returns {Promise<object>} Dashboard metrics and alerts.
 */
export const fetchDashboardAnalytics = async (params = {}) => {
  const response = await apiClient.get('/reports/dashboard', { params });
  return response.data.data;
};

/**
 * Fetches itemized and summary inventory valuation report.
 *
 * @param {object} [params={}] - Filter parameters (warehouse, category, minStock).
 * @returns {Promise<{summary: object, items: Array<object>}>} Valuation report data.
 */
export const fetchValuationReport = async (params = {}) => {
  const response = await apiClient.get('/reports/inventory-valuation', { params });
  return response.data.data;
};

/**
 * Fetches inventory turnover ratios and stock velocity classifications.
 *
 * @param {object} [params={}] - Filter parameters (warehouse, days).
 * @returns {Promise<{summary: object, items: Array<object>}>} Turnover velocity data.
 */
export const fetchTurnoverReport = async (params = {}) => {
  const response = await apiClient.get('/reports/turnover', { params });
  return response.data.data;
};

/**
 * Fetches batch shelf-life aging and expiry risk buckets.
 *
 * @param {object} [params={}] - Filter parameters (warehouse, category).
 * @returns {Promise<{summary: object, items: Array<object>}>} Aging and expiry data.
 */
export const fetchAgingReport = async (params = {}) => {
  const response = await apiClient.get('/reports/aging', { params });
  return response.data.data;
};

/**
 * Fetches audit variance and shrinkage discrepancy report.
 *
 * @param {object} [params={}] - Filter parameters (warehouse, startDate, endDate).
 * @returns {Promise<{summary: object, items: Array<object>}>} Discrepancy report data.
 */
export const fetchDiscrepancyReport = async (params = {}) => {
  const response = await apiClient.get('/reports/discrepancies', { params });
  return response.data.data;
};

/**
 * Downloads report data as an RFC 4180 compliant CSV spreadsheet file.
 *
 * @param {string} reportType - Report slug ('valuation', 'turnover', 'aging', 'discrepancy').
 * @param {object} [params={}] - Query filters.
 * @returns {Promise<void>}
 */
export const downloadReportCsv = async (reportType, params = {}) => {
  const response = await apiClient.get(`/reports/export/${reportType}`, {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const timestamp = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `stockpilot-${reportType}-report-${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};
