/**
 * StockPilot WMS - Versioned API router.
 *
 * Every module registers its router here under /api/v1.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import categoryRoutes from '../modules/categories/category.routes.js';
import unitRoutes from '../modules/units/unit.routes.js';
import productRoutes from '../modules/products/product.routes.js';
import supplierRoutes from '../modules/suppliers/supplier.routes.js';
import customerRoutes from '../modules/customers/customer.routes.js';
import warehouseRoutes from '../modules/warehouses/warehouse.routes.js';
import { locationRouter } from '../modules/locations/location.routes.js';
import inventoryRoutes from '../modules/inventory/inventory.routes.js';
import batchRoutes from '../modules/inventory/batch.routes.js';
import serialRoutes from '../modules/inventory/serial.routes.js';
import purchaseOrderRoutes from '../modules/purchasing/purchaseOrder.routes.js';
import goodsReceiptRoutes from '../modules/inbound/goodsReceipt.routes.js';
import putawayTaskRoutes from '../modules/inbound/putawayTask.routes.js';
import salesOrderRoutes from '../modules/outbound/salesOrder.routes.js';
import pickListRoutes from '../modules/outbound/pickList.routes.js';
import shipmentRoutes from '../modules/outbound/shipment.routes.js';
import returnOrderRoutes from '../modules/returns/returnOrder.routes.js';
import transferOrderRoutes from '../modules/transfers/transferOrder.routes.js';
import cycleCountRoutes from '../modules/counts/cycleCount.routes.js';
import stockAdjustmentRoutes from '../modules/adjustments/stockAdjustment.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/units', unitRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/locations', locationRouter);
router.use('/inventory', inventoryRoutes);
router.use('/batches', batchRoutes);
router.use('/serials', serialRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/goods-receipts', goodsReceiptRoutes);
router.use('/putaway-tasks', putawayTaskRoutes);
router.use('/sales-orders', salesOrderRoutes);
router.use('/pick-lists', pickListRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/returns', returnOrderRoutes);
router.use('/transfers', transferOrderRoutes);
router.use('/counts', cycleCountRoutes);
router.use('/adjustments', stockAdjustmentRoutes);
router.use('/reports', reportsRoutes);

export default router;
