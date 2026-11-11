/**
 * StockPilot WMS - Inbound Operations Integration Tests.
 *
 * Verifies purchase order lifecycles, goods receiving at dock, stock ledger postings,
 * lot and serial registration, directed putaway bin suggestions, and putaway execution.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Warehouse } from '../src/modules/warehouses/warehouse.model.js';
import { Location, LOCATION_TYPES, LOCATION_PURPOSES } from '../src/modules/locations/location.model.js';
import { Product, TRACKING_TYPES } from '../src/modules/products/product.model.js';
import { Category } from '../src/modules/categories/category.model.js';
import { Unit } from '../src/modules/units/unit.model.js';
import { Supplier } from '../src/modules/suppliers/supplier.model.js';
import { PurchaseOrder, PO_STATUSES } from '../src/modules/purchasing/purchaseOrder.model.js';
import { GoodsReceipt } from '../src/modules/inbound/goodsReceipt.model.js';
import { PutawayTask, PUTAWAY_STATUSES } from '../src/modules/inbound/putawayTask.model.js';
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { Batch } from '../src/modules/inventory/batch.model.js';
import { Serial, SERIAL_STATUSES } from '../src/modules/inventory/serial.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let replSet;
let adminUser;
let adminToken;
let warehouse;
let receivingDock;
let storageBinA;
let supplier;
let productNone;
let productBatch;
let productSerial;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Purchasing Admin',
    email: 'purchasing.admin@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
  });

  warehouse = await Warehouse.create({
    name: 'Inbound Logistics Facility',
    code: 'WH-INB',
    type: 'DISTRIBUTION_CENTER',
    isActive: true,
  });

  receivingDock = await Location.create({
    warehouse: warehouse._id,
    name: 'Receiving Dock 01',
    code: 'RECEIVING',
    type: LOCATION_TYPES.ZONE,
    purpose: LOCATION_PURPOSES.RECEIVING,
    path: 'WH-INB/RECEIVING',
    isActive: true,
  });

  storageBinA = await Location.create({
    warehouse: warehouse._id,
    name: 'Storage Bin A-01-01',
    code: 'BIN-A01',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-INB/ZONE-A/BIN-A01',
    isActive: true,
  });

  const category = await Category.create({ name: 'Fasteners', code: 'FAST', isActive: true });
  const unitPcs = await Unit.create({ name: 'Pieces', code: 'PCS', allowDecimals: false, isActive: true });

  supplier = await Supplier.create({
    name: 'Acme Fasteners Co',
    code: 'SUP-ACME',
    email: 'vendor@acmefasteners.com',
    paymentTermsDays: 30,
    isActive: true,
  });

  productNone = await Product.create({
    sku: 'FAST-M6-20',
    name: 'Steel Screw M6x20mm',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.NONE,
    costPriceMinor: 25,
    salePriceMinor: 60,
    barcode: 'BC-INB-001',
    isActive: true,
  });

  productBatch = await Product.create({
    sku: 'EPOXY-RESIN-500ML',
    name: 'Epoxy Resin Tube 500ml',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.BATCH,
    hasExpiry: true,
    costPriceMinor: 1200,
    salePriceMinor: 2400,
    barcode: 'BC-INB-002',
    isActive: true,
  });

  productSerial = await Product.create({
    sku: 'DIGITAL-CALIPER-150',
    name: 'Precision Digital Caliper 150mm',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.SERIAL,
    costPriceMinor: 4500,
    salePriceMinor: 8900,
    barcode: 'BC-INB-003',
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await StockLedgerEntry.collection.deleteMany({});
  await StockBalance.deleteMany({});
  await Batch.deleteMany({});
  await Serial.deleteMany({});
  await PurchaseOrder.deleteMany({});
  await GoodsReceipt.deleteMany({});
  await PutawayTask.deleteMany({});
});

describe('Phase 6: Purchase Order Management', () => {
  it('creates a draft purchase order with correct monetary calculations', async () => {
    const res = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        notes: 'Urgent restocking',
        items: [
          {
            product: productNone._id.toString(),
            orderedQty: 200,
            unitPriceMinor: 25,
          },
          {
            product: productBatch._id.toString(),
            orderedQty: 50,
            unitPriceMinor: 1200,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe(PO_STATUSES.DRAFT);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.subtotalMinor).toBe(200 * 25 + 50 * 1200);
    expect(res.body.data.totalMinor).toBe(res.body.data.subtotalMinor);
  });

  it('confirms a draft purchase order and prohibits unauthorized modifications', async () => {
    const createRes = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productNone._id.toString(),
            orderedQty: 100,
            unitPriceMinor: 30,
          },
        ],
      });

    const poId = createRes.body.data._id;

    const confirmRes = await request(app)
      .post(`/api/v1/purchase-orders/${poId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe(PO_STATUSES.CONFIRMED);
    expect(confirmRes.body.data.confirmedAt).toBeTruthy();

    const modifyRes = await request(app)
      .put(`/api/v1/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Attempting to modify confirmed PO',
      });

    expect(modifyRes.status).toBe(400);
    expect(modifyRes.body.error.message).toMatch(/cannot modify purchase order in status CONFIRMED/i);
  });
});

describe('Phase 6: Goods Receipt (GRN) Intake & Stock Ledger Integration', () => {
  it('receives goods into receiving dock, posts ledger entries, and generates putaway tasks', async () => {
    const poRes = await request(app)
      .post('/api/v1/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productNone._id.toString(),
            orderedQty: 100,
            unitPriceMinor: 25,
          },
        ],
      });

    const poId = poRes.body.data._id;
    await request(app)
      .post(`/api/v1/purchase-orders/${poId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    const grnRes = await request(app)
      .post('/api/v1/goods-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchaseOrder: poId,
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        vendorInvoiceNo: 'INV-ACME-991',
        items: [
          {
            product: productNone._id.toString(),
            receivedQty: 100,
            unitCostMinor: 25,
          },
        ],
      });

    expect(grnRes.status).toBe(201);
    expect(grnRes.body.data.grnNumber).toMatch(/^GRN-\d{4}-\d{4}$/);

    const updatedPo = await PurchaseOrder.findById(poId);
    expect(updatedPo.status).toBe(PO_STATUSES.COMPLETED);
    expect(updatedPo.items[0].receivedQty).toBe(100);

    const dockBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: receivingDock._id,
      product: productNone._id,
    });
    expect(dockBalance).toBeTruthy();
    expect(dockBalance.onHand).toBe(100);

    const ledgerEntries = await StockLedgerEntry.find({
      referenceType: 'GOODS_RECEIPT',
      referenceId: grnRes.body.data._id,
    });
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0].movementType).toBe(MOVEMENT_TYPES.PURCHASE_RECEIPT);
    expect(ledgerEntries[0].quantity).toBe(100);

    const tasks = await PutawayTask.find({
      goodsReceipt: grnRes.body.data._id,
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe(PUTAWAY_STATUSES.PENDING);
    expect(tasks[0].quantity).toBe(100);
    expect(tasks[0].sourceLocation.toString()).toBe(receivingDock._id.toString());
  });

  it('receives batch-tracked and serial-tracked products and registers inventory assets', async () => {
    const grnRes = await request(app)
      .post('/api/v1/goods-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productBatch._id.toString(),
            receivedQty: 25,
            unitCostMinor: 1200,
            batchNumber: 'LOT-EPOXY-2026',
            expiresOn: '2028-06-30',
          },
          {
            product: productSerial._id.toString(),
            receivedQty: 2,
            unitCostMinor: 4500,
            serialNumbers: ['SN-CAL-001', 'SN-CAL-002'],
          },
        ],
      });

    expect(grnRes.status).toBe(201);

    const createdBatch = await Batch.findOne({ batchNumber: 'LOT-EPOXY-2026' });
    expect(createdBatch).toBeTruthy();
    expect(createdBatch.product.toString()).toBe(productBatch._id.toString());

    const createdSerials = await Serial.find({
      serialNumber: { $in: ['SN-CAL-001', 'SN-CAL-002'] },
    });
    expect(createdSerials).toHaveLength(2);
    expect(createdSerials[0].status).toBe(SERIAL_STATUSES.IN_STOCK);

    const batchBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: receivingDock._id,
      product: productBatch._id,
      batch: createdBatch._id,
    });
    expect(batchBalance.onHand).toBe(25);

    const serialBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: receivingDock._id,
      product: productSerial._id,
    });
    expect(serialBalance.onHand).toBe(2);
  });
});

describe('Phase 6: Directed Putaway Execution', () => {
  it('executes putaway from receiving dock to destination storage bin and updates balances', async () => {
    const grnRes = await request(app)
      .post('/api/v1/goods-receipts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplier: supplier._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productNone._id.toString(),
            receivedQty: 50,
            unitCostMinor: 25,
          },
        ],
      });

    const grnId = grnRes.body.data._id;
    const task = await PutawayTask.findOne({ goodsReceipt: grnId });
    expect(task).toBeTruthy();
    expect(task.status).toBe(PUTAWAY_STATUSES.PENDING);

    const completeRes = await request(app)
      .post(`/api/v1/putaway-tasks/${task._id}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        destinationLocation: storageBinA._id.toString(),
        notes: 'Placed on tier 1',
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe(PUTAWAY_STATUSES.COMPLETED);

    const dockBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: receivingDock._id,
      product: productNone._id,
    });
    expect(dockBalance.onHand).toBe(0);

    const storageBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: storageBinA._id,
      product: productNone._id,
    });
    expect(storageBalance.onHand).toBe(50);

    const putawayMovements = await StockLedgerEntry.find({
      referenceType: 'PUTAWAY_TASK',
      referenceId: task._id.toString(),
    });
    expect(putawayMovements).toHaveLength(2);
    const deduction = putawayMovements.find((m) => m.quantity < 0);
    const addition = putawayMovements.find((m) => m.quantity > 0);
    expect(deduction.location.toString()).toBe(receivingDock._id.toString());
    expect(deduction.quantity).toBe(-50);
    expect(addition.location.toString()).toBe(storageBinA._id.toString());
    expect(addition.quantity).toBe(50);
  });
});
