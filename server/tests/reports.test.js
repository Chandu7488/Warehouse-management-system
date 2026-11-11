/**
 * StockPilot WMS - Analytics & Reports Integration Tests.
 *
 * Verifies executive dashboard metrics, inventory valuation, stock turnover,
 * shelf-life batch aging, discrepancy audits, and CSV export streaming.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
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
import { Batch } from '../src/modules/inventory/batch.model.js';
import { MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { postMovements } from '../src/modules/inventory/stockPosting.service.js';

let replSet;
let adminUser;
let adminToken;
let warehouse;
let bin;
let product1;
let product2;
let batchFresh;
let batchExpiring;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Analytics Director',
    email: 'analytics.director@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });

  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
    email: adminUser.email,
  });

  warehouse = await Warehouse.create({
    code: 'WH-REP',
    name: 'Reporting Analytics Hub',
    address: { line1: '770 Data Way', city: 'Seattle', country: 'USA' },
    isActive: true,
  });

  bin = await Location.create({
    warehouse: warehouse._id,
    code: 'REP-01-A',
    name: 'Reporting Storage Bin 1',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-REP > Zone A > Aisle 1 > Bin A',
    isActive: true,
  });

  const category = await Category.create({ name: 'Robotics Components', code: 'ROB' });
  const unit = await Unit.create({ name: 'Piece', code: 'PC' });

  product1 = await Product.create({
    sku: 'SKU-ROB-01',
    name: 'Precision Stepper Motor',
    category: category._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.BATCH,
    hasExpiry: true,
    costPriceMinor: 5000, // $50.00
    salePriceMinor: 8500, // $85.00
    reorderLevel: 10,
    reorderQuantity: 50,
    isActive: true,
  });

  product2 = await Product.create({
    sku: 'SKU-ROB-02',
    name: 'Micro Servo Actuator',
    category: category._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    costPriceMinor: 1500, // $15.00
    salePriceMinor: 3000, // $30.00
    reorderLevel: 25,
    reorderQuantity: 100,
    isActive: true,
  });

  // Create batches for product1: one fresh, one expiring in 15 days
  const now = new Date();
  const futureExp = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000); // 120 days
  const nearExp = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days

  batchFresh = await Batch.create({
    product: product1._id,
    batchNumber: 'LOT-FRESH-01',
    expiresOn: futureExp,
    status: 'ACTIVE',
  });

  batchExpiring = await Batch.create({
    product: product1._id,
    batchNumber: 'LOT-EXP-15D',
    expiresOn: nearExp,
    status: 'ACTIVE',
  });

  // Seed stock balances using stockPosting engine
  await postMovements({
    movements: [
      {
        warehouse: warehouse._id.toString(),
        location: bin._id.toString(),
        product: product1._id.toString(),
        batch: batchFresh._id.toString(),
        quantity: 40,
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-REP-01',
        lineId: 'line-1',
        reason: 'Initial test stock fresh',
      },
      {
        warehouse: warehouse._id.toString(),
        location: bin._id.toString(),
        product: product1._id.toString(),
        batch: batchExpiring._id.toString(),
        quantity: 10,
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-REP-02',
        lineId: 'line-2',
        reason: 'Initial test stock near expiry',
      },
      {
        warehouse: warehouse._id.toString(),
        location: bin._id.toString(),
        product: product2._id.toString(),
        quantity: 20, // below reorderLevel (25) -> triggers low stock alert!
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-REP-03',
        lineId: 'line-3',
        reason: 'Initial test stock below reorder level',
      },
    ],
    actor: { id: adminUser._id.toString(), email: adminUser.email },
  });

  // Seed a Sales Issue for product1 to test turnover calculation
  await postMovements({
    movements: [
      {
        warehouse: warehouse._id.toString(),
        location: bin._id.toString(),
        product: product1._id.toString(),
        batch: batchFresh._id.toString(),
        quantity: -20,
        movementType: MOVEMENT_TYPES.SALES_ISSUE,
        referenceType: 'Shipment',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'SHP-REP-01',
        lineId: 'line-1',
        reason: 'Sales order dispatch',
      },
      {
        warehouse: warehouse._id.toString(),
        location: bin._id.toString(),
        product: product2._id.toString(),
        quantity: -2,
        movementType: MOVEMENT_TYPES.WRITE_OFF,
        referenceType: 'StockAdjustment',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'ADJ-REP-01',
        lineId: 'line-1',
        reason: 'Damaged item written off',
      },
    ],
    actor: { id: adminUser._id.toString(), email: adminUser.email },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

describe('Phase 11 - Executive Dashboard Analytics', () => {
  it('aggregates real-time dashboard KPIs, valuation, and stock alerts', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/dashboard?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const { valuation, criticalAlerts, expiringBatches, audits } = res.body.data;

    // Valuation verification:
    // product1: (40 - 20) in fresh + 10 in exp = 30 units on hand * $50 = $1500 (150,000 minor)
    // product2: 20 - 2 = 18 units on hand * $15 = $270 (27,000 minor)
    // Total onHand = 30 + 18 = 48 units.
    expect(valuation.totalQuantity).toBe(48);
    expect(valuation.totalCostValueMinor).toBe(177000); // 150000 + 27000

    // Critical low stock alert: product2 onHand is 18, reorderLevel is 25
    expect(criticalAlerts.length).toBeGreaterThanOrEqual(1);
    const p2Alert = criticalAlerts.find((a) => a.sku === product2.sku);
    expect(p2Alert).toBeDefined();
    expect(p2Alert.totalOnHand).toBe(18);

    // Expiring batch: LOT-EXP-15D expires in 15 days
    expect(expiringBatches.length).toBeGreaterThanOrEqual(1);
    const expBatch = expiringBatches.find((b) => b.batchNumber === 'LOT-EXP-15D');
    expect(expBatch).toBeDefined();
    expect(expBatch.daysRemaining).toBeLessThanOrEqual(30);

    expect(audits.accuracyRate).toBeDefined();
  });
});

describe('Phase 11 - Inventory Valuation & Asset Breakdown', () => {
  it('generates itemized valuation report with cost, sale, and margin calculations', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/inventory-valuation?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, summary } = res.body.data;
    expect(items).toHaveLength(2);

    const item1 = items.find((i) => i.sku === product1.sku);
    expect(item1).toBeDefined();
    expect(item1.onHand).toBe(30);
    expect(item1.costPriceMinor).toBe(5000);
    expect(item1.salePriceMinor).toBe(8500);
    expect(item1.totalCostMinor).toBe(150000);
    expect(item1.totalSaleMinor).toBe(255000);
    expect(item1.marginMinor).toBe(105000);

    expect(summary.totalQuantity).toBe(48);
    expect(summary.totalCostMinor).toBe(177000);
    expect(summary.totalSaleMinor).toBe(309000); // 255000 + (18 * 3000 = 54000)
  });
});

describe('Phase 11 - Inventory Turnover & Velocity Analytics', () => {
  it('calculates turnover velocity ratios based on outbound movements', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/turnover?warehouse=${warehouse._id}&timeWindowDays=90`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, summary } = res.body.data;
    expect(items.length).toBeGreaterThanOrEqual(2);

    // product1 had 20 issued units
    const item1 = items.find((i) => i.sku === product1.sku);
    expect(item1).toBeDefined();
    expect(item1.issuedQty).toBe(20);
    expect(item1.turnoverRatio).toBeGreaterThan(0);

    // product2 had 0 SALES_ISSUE units -> DEAD_STOCK
    const item2 = items.find((i) => i.sku === product2.sku);
    expect(item2).toBeDefined();
    expect(item2.issuedQty).toBe(0);
    expect(item2.velocity).toBe('DEAD_STOCK');

    expect(summary.totalProductsEvaluated).toBeGreaterThanOrEqual(2);
  });
});

describe('Phase 11 - Batch Shelf-Life Aging & Expiry Risks', () => {
  it('categorizes batches into CRITICAL and HEALTHY expiry buckets', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/aging?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, summary } = res.body.data;
    expect(items.length).toBeGreaterThanOrEqual(2);

    const nearBatch = items.find((b) => b.batchNumber === 'LOT-EXP-15D');
    expect(nearBatch).toBeDefined();
    expect(nearBatch.status).toBe('CRITICAL');
    expect(nearBatch.daysRemaining).toBeLessThanOrEqual(30);

    const freshBatch = items.find((b) => b.batchNumber === 'LOT-FRESH-01');
    expect(freshBatch).toBeDefined();
    expect(freshBatch.status).toBe('HEALTHY');
    expect(freshBatch.daysRemaining).toBeGreaterThan(90);

    expect(summary.criticalCount).toBeGreaterThanOrEqual(1);
    expect(summary.healthyCount).toBeGreaterThanOrEqual(1);
  });
});

describe('Phase 11 - Discrepancy & Shrinkage Audits', () => {
  it('aggregates write-offs and adjustment losses', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/discrepancies?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { items, summary } = res.body.data;
    expect(items.length).toBeGreaterThanOrEqual(1);

    const writeOffItem = items.find((i) => i.movementType === 'WRITE_OFF');
    expect(writeOffItem).toBeDefined();
    expect(writeOffItem.quantity).toBe(-2);

    expect(summary.totalWriteOffQty).toBe(2);
  });
});

describe('Phase 11 - CSV Stream Export Serialization', () => {
  it('exports valuation report as RFC 4180 compliant CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/export/valuation?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('SKU,Product Name,Category,Warehouse Code');
    expect(res.text).toContain(product1.sku);
    expect(res.text).toContain(product2.sku);
  });

  it('exports aging report as CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/export/aging?warehouse=${warehouse._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Batch #,SKU,Product Name,Warehouse');
    expect(res.text).toContain('LOT-EXP-15D');
    expect(res.text).toContain('LOT-FRESH-01');
  });
});
