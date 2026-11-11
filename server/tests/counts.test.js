/**
 * StockPilot WMS - Cycle Counting & Stock Adjustment Integration Tests.
 *
 * Verifies count planning, snapshot freezing, blind counting, recount flagging,
 * discrepancy ledger reconciliation (ADJUSTMENT_GAIN / ADJUSTMENT_LOSS),
 * and direct stock adjustment write-off approval workflows.
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
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { postMovements } from '../src/modules/inventory/stockPosting.service.js';
import { COUNT_STATUSES, COUNT_TYPES } from '../src/modules/counts/cycleCount.model.js';
import { ADJUSTMENT_TYPES, ADJUSTMENT_STATUSES } from '../src/modules/adjustments/stockAdjustment.model.js';

let replSet;
let adminUser;
let adminToken;
let warehouse;
let bin1;
let bin2;
let productA;
let productB;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Audit Manager',
    email: 'audit.manager@stockpilot.local',
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
    code: 'WH-AUDIT',
    name: 'Audit Test Facility',
    address: { line1: '500 Audit Blvd', city: 'Denver', country: 'USA' },
    isActive: true,
  });

  bin1 = await Location.create({
    warehouse: warehouse._id,
    code: 'AUD-01-A',
    name: 'Audit Bin 1',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-AUDIT > Zone A > Aisle 1 > Bin A',
    isActive: true,
  });

  bin2 = await Location.create({
    warehouse: warehouse._id,
    code: 'AUD-01-B',
    name: 'Audit Bin 2',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-AUDIT > Zone A > Aisle 1 > Bin B',
    isActive: true,
  });

  const cat = await Category.create({ name: 'Audit Category', code: 'AUD-CAT' });
  const unit = await Unit.create({ name: 'Unit', code: 'UNT' });

  productA = await Product.create({
    sku: 'SKU-AUD-001',
    name: 'Precision Calibration Sensor',
    category: cat._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    costPriceMinor: 2500, // $25.00
    salePriceMinor: 4000,
    isActive: true,
  });

  productB = await Product.create({
    sku: 'SKU-AUD-002',
    name: 'High-Torque Fastener Box',
    category: cat._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    costPriceMinor: 1000, // $10.00
    salePriceMinor: 1800,
    isActive: true,
  });

  // Seed inventory: 50 of productA in bin1, 100 of productB in bin2
  await postMovements({
    movements: [
      {
        warehouse: warehouse._id.toString(),
        location: bin1._id.toString(),
        product: productA._id.toString(),
        quantity: 50,
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-AUD-001',
        lineId: 'line-1',
        reason: 'Initial audit test stock',
      },
      {
        warehouse: warehouse._id.toString(),
        location: bin2._id.toString(),
        product: productB._id.toString(),
        quantity: 100,
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-AUD-002',
        lineId: 'line-2',
        reason: 'Initial audit test stock',
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

describe('Phase 10 - Cycle Counting Lifecycle', () => {
  let countId;
  let lineItemAId;
  let lineItemBId;

  it('creates a new cycle count plan with target warehouse scope', async () => {
    const res = await request(app)
      .post('/api/v1/counts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: COUNT_TYPES.CYCLE_COUNT,
        warehouse: warehouse._id.toString(),
        blindCount: true,
        notes: 'Monthly high-value calibration sensor audit',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.countNumber).toMatch(/^CC-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe(COUNT_STATUSES.DRAFT);
    expect(res.body.data.blindCount).toBe(true);

    countId = res.body.data._id || res.body.data.id;
  });

  it('starts the count session and freezes snapshot inventory balances', async () => {
    const res = await request(app)
      .post(`/api/v1/counts/${countId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(COUNT_STATUSES.IN_PROGRESS);
    expect(res.body.data.items).toHaveLength(2);

    const itemA = res.body.data.items.find((i) => i.product.sku === productA.sku);
    const itemB = res.body.data.items.find((i) => i.product.sku === productB.sku);

    expect(itemA).toBeDefined();
    expect(itemA.snapshotQty).toBe(50);
    expect(itemA.unitCostMinor).toBe(2500);
    expect(itemA.countedQty).toBeNull();

    expect(itemB).toBeDefined();
    expect(itemB.snapshotQty).toBe(100);
    expect(itemB.countedQty).toBeNull();

    lineItemAId = itemA._id || itemA.id;
    lineItemBId = itemB._id || itemB.id;
  });

  it('submits physical blind count entries and calculates discrepancies', async () => {
    // Physical count:
    // Product A: 48 (loss of 2 units -> -$50.00 variance)
    // Product B: 105 (gain of 5 units -> +$50.00 variance)
    const res = await request(app)
      .post(`/api/v1/counts/${countId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { itemId: lineItemAId, countedQty: 48, notes: 'Missing 2 sensors' },
          { itemId: lineItemBId, countedQty: 105, notes: 'Found 5 extra boxes' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(COUNT_STATUSES.COUNTED);
    expect(res.body.data.varianceItems).toBe(2);
    expect(res.body.data.matchedItems).toBe(0);

    const itemA = res.body.data.items.find((i) => String(i._id) === String(lineItemAId));
    expect(itemA.varianceQty).toBe(-2);
    expect(itemA.varianceValueMinor).toBe(-5000); // -2 * 2500

    const itemB = res.body.data.items.find((i) => String(i._id) === String(lineItemBId));
    expect(itemB.varianceQty).toBe(5);
    expect(itemB.varianceValueMinor).toBe(5000); // 5 * 1000

    expect(res.body.data.netVarianceValueMinor).toBe(0); // -5000 + 5000 = 0
  });

  it('requests a recount for an item with discrepancy', async () => {
    const res = await request(app)
      .post(`/api/v1/counts/${countId}/recount`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemIds: [lineItemAId],
        notes: 'Recount requested: verify shelf top bin',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(COUNT_STATUSES.IN_PROGRESS);

    const itemA = res.body.data.items.find((i) => String(i._id) === String(lineItemAId));
    expect(itemA.status).toBe('RECOUNT_REQUESTED');
    expect(itemA.countedQty).toBeNull();
  });

  it('re-submits recount confirmation', async () => {
    const res = await request(app)
      .post(`/api/v1/counts/${countId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ itemId: lineItemAId, countedQty: 49, notes: 'Found 1 sensor under tray' }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(COUNT_STATUSES.COUNTED);

    const itemA = res.body.data.items.find((i) => String(i._id) === String(lineItemAId));
    expect(itemA.varianceQty).toBe(-1); // 49 - 50 = -1
    expect(itemA.varianceValueMinor).toBe(-2500);
  });

  it('reconciles discrepancies into the stock ledger and updates stock balances', async () => {
    const res = await request(app)
      .post(`/api/v1/counts/${countId}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Reconciliation approved by audit manager',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(COUNT_STATUSES.RECONCILED);

    // Verify stock balance for product A in bin 1 updated from 50 to 49
    const balanceA = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: bin1._id,
      product: productA._id,
    });
    expect(balanceA.onHand).toBe(49);

    // Verify stock balance for product B in bin 2 updated from 100 to 105
    const balanceB = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: bin2._id,
      product: productB._id,
    });
    expect(balanceB.onHand).toBe(105);

    // Verify StockLedger entries for ADJUSTMENT_LOSS (-1) and ADJUSTMENT_GAIN (+5)
    const ledgerLoss = await StockLedgerEntry.findOne({
      referenceType: 'CYCLE_COUNT',
      referenceId: countId,
      movementType: MOVEMENT_TYPES.ADJUSTMENT_LOSS,
    });
    expect(ledgerLoss).toBeDefined();
    expect(ledgerLoss.quantity).toBe(-1);

    const ledgerGain = await StockLedgerEntry.findOne({
      referenceType: 'CYCLE_COUNT',
      referenceId: countId,
      movementType: MOVEMENT_TYPES.ADJUSTMENT_GAIN,
    });
    expect(ledgerGain).toBeDefined();
    expect(ledgerGain.quantity).toBe(5);
  });
});

describe('Phase 10 - Direct Stock Adjustments & Write-offs', () => {
  let adjustmentId;

  it('rejects an adjustment proposal that attempts to deduct more stock than available', async () => {
    const res = await request(app)
      .post('/api/v1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: ADJUSTMENT_TYPES.WRITE_OFF,
        warehouse: warehouse._id.toString(),
        reason: 'Scrapping obsolete stock',
        items: [
          {
            product: productA._id.toString(),
            location: bin1._id.toString(),
            quantity: -999, // only 49 available
            reason: 'Excessive deduction test',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates a valid stock write-off proposal for damaged items', async () => {
    const res = await request(app)
      .post('/api/v1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: ADJUSTMENT_TYPES.WRITE_OFF,
        warehouse: warehouse._id.toString(),
        reason: 'Damaged packaging during forklift transit',
        items: [
          {
            product: productA._id.toString(),
            location: bin1._id.toString(),
            quantity: -4,
            reason: 'Crushed box',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adjustmentNumber).toMatch(/^ADJ-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe(ADJUSTMENT_STATUSES.DRAFT);
    expect(res.body.data.netQuantity).toBe(-4);

    adjustmentId = res.body.data._id || res.body.data.id;
  });

  it('approves the write-off proposal and writes off inventory in the stock ledger', async () => {
    const res = await request(app)
      .post(`/api/v1/adjustments/${adjustmentId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'Approved by warehouse supervisor',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(ADJUSTMENT_STATUSES.APPROVED);

    // Verify stock balance for product A in bin 1 dropped from 49 to 45
    const balanceA = await StockBalance.findOne({
      warehouse: warehouse._id,
      location: bin1._id,
      product: productA._id,
    });
    expect(balanceA.onHand).toBe(45);

    // Verify StockLedger entry for WRITE_OFF
    const ledgerEntry = await StockLedgerEntry.findOne({
      referenceType: 'STOCK_ADJUSTMENT',
      referenceId: adjustmentId,
      movementType: MOVEMENT_TYPES.WRITE_OFF,
    });
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry.quantity).toBe(-4);
  });

  it('creates and rejects an ad-hoc adjustment proposal', async () => {
    const createRes = await request(app)
      .post('/api/v1/adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: ADJUSTMENT_TYPES.MANUAL_ADJUSTMENT,
        warehouse: warehouse._id.toString(),
        reason: 'Unverified manual adjustment',
        items: [
          {
            product: productB._id.toString(),
            location: bin2._id.toString(),
            quantity: 2,
            reason: 'Found on table',
          },
        ],
      });

    expect(createRes.status).toBe(201);
    const rejId = createRes.body.data._id || createRes.body.data.id;

    const rejRes = await request(app)
      .post(`/api/v1/adjustments/${rejId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Investigation showed these belong to pending batch',
      });

    expect(rejRes.status).toBe(200);
    expect(rejRes.body.data.status).toBe(ADJUSTMENT_STATUSES.REJECTED);
  });
});
