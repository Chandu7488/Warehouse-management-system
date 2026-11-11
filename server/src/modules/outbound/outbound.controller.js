/**
 * StockPilot WMS - Outbound Operations Controller.
 *
 * Translates HTTP requests for Sales Orders, Pick Lists, and Shipments.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import * as soService from './salesOrder.service.js';
import * as pickingService from './picking.service.js';
import * as shippingService from './shipping.service.js';
import { sendSuccess } from '../../utils/apiResponse.js';

// Sales Orders
export const createSalesOrderHandler = async (req, res) => {
  const so = await soService.createSalesOrder(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Sales order created successfully',
    data: so,
  });
};

export const listSalesOrdersHandler = async (req, res) => {
  const result = await soService.listSalesOrders(req.validated.query);
  return sendSuccess(res, {
    message: 'Sales orders retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getSalesOrderByIdHandler = async (req, res) => {
  const so = await soService.getSalesOrderById(req.params.id);
  return sendSuccess(res, {
    message: 'Sales order retrieved successfully',
    data: so,
  });
};

export const updateSalesOrderHandler = async (req, res) => {
  const so = await soService.updateSalesOrder(req.params.id, req.validated.body);
  return sendSuccess(res, {
    message: 'Sales order updated successfully',
    data: so,
  });
};

export const confirmSalesOrderHandler = async (req, res) => {
  const so = await soService.confirmSalesOrder(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Sales order confirmed and stock reserved successfully',
    data: so,
  });
};

export const allocateSalesOrderHandler = async (req, res) => {
  const so = await soService.allocateSalesOrderAction(req.params.id);
  return sendSuccess(res, {
    message: 'Sales order stock allocated successfully',
    data: so,
  });
};

export const cancelSalesOrderHandler = async (req, res) => {
  const so = await soService.cancelSalesOrder(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Sales order cancelled and reservations released successfully',
    data: so,
  });
};

// Pick Lists
export const createPickListHandler = async (req, res) => {
  const pickList = await pickingService.createPickList(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Pick list created successfully and path optimized',
    data: pickList,
  });
};

export const listPickListsHandler = async (req, res) => {
  const result = await pickingService.listPickLists(req.validated.query);
  return sendSuccess(res, {
    message: 'Pick lists retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getPickListByIdHandler = async (req, res) => {
  const pickList = await pickingService.getPickListById(req.params.id);
  return sendSuccess(res, {
    message: 'Pick list retrieved successfully',
    data: pickList,
  });
};

export const startPickListHandler = async (req, res) => {
  const pickList = await pickingService.startPickList(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Pick list commenced successfully',
    data: pickList,
  });
};

export const confirmPickItemHandler = async (req, res) => {
  const pickList = await pickingService.confirmPickItem(
    req.params.id,
    { itemId: req.params.itemId, ...req.validated.body },
    req.user,
  );
  return sendSuccess(res, {
    message: 'Pick task item confirmed successfully',
    data: pickList,
  });
};

export const cancelPickListHandler = async (req, res) => {
  const pickList = await pickingService.cancelPickList(req.params.id);
  return sendSuccess(res, {
    message: 'Pick list cancelled successfully',
    data: pickList,
  });
};

// Shipments
export const createShipmentHandler = async (req, res) => {
  const shipment = await shippingService.createShipment(req.validated.body, req.user);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Shipment created successfully',
    data: shipment,
  });
};

export const listShipmentsHandler = async (req, res) => {
  const result = await shippingService.listShipments(req.validated.query);
  return sendSuccess(res, {
    message: 'Shipments retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
};

export const getShipmentByIdHandler = async (req, res) => {
  const shipment = await shippingService.getShipmentById(req.params.id);
  return sendSuccess(res, {
    message: 'Shipment retrieved successfully',
    data: shipment,
  });
};

export const dispatchShipmentHandler = async (req, res) => {
  const shipment = await shippingService.dispatchShipment(req.params.id, req.validated.body, req.user);
  return sendSuccess(res, {
    message: 'Shipment dispatched and stock ledger updated successfully',
    data: shipment,
  });
};
