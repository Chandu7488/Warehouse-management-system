/**
 * StockPilot WMS - Transfers & Replenishment Integration Tests.
 *
 * Verifies intra-warehouse atomic relocation, inter-warehouse facility transit
 * lifecycle (dispatch -> in transit -> receive), and min/max forward pick
 * face replenishment evaluation engine.
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
import {
  TRANSFER_TYPES,
  TRANSFER_STATUSES,
} from '../src/modules/transfers/transferOrder.model.js';
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { postMovements } from '../src/modules/inventory/stockPosting.service.js';

let replSet;
let adminUser;
let adminToken;
let warehouseA;
let warehouseB;
let binA1;
let binA2;
let pickBinA;
let binB1;
let productItem;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Transfers Manager',
    email: 'transfers.manager@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });

  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
    email: adminUser.email,
  });

  warehouseA = await Warehouse.create({
    code: 'WH-DAL',
    name: 'Dallas Central Facility',
    address: { line1: '100 Logistics Pkwy', city: 'Dallas', country: 'USA' },
    isActive: true,
  });

  warehouseB = await Warehouse.create({
    code: 'WH-HOU',
    name: 'Houston Regional Hub',
    address: { line1: '200 Port Blvd', city: 'Houston', country: 'USA' },
    isActive: true,
  });

  binA1 = await Location.create({
    warehouse: warehouseA._id,
    code: 'A-01-01',
    name: 'Bulk Storage Bin A1',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-DAL > Zone A > Aisle 1 > Bin 01',
    isActive: true,
  });

  binA2 = await Location.create({
    warehouse: warehouseA._id,
    code: 'A-01-02',
    name: 'Bulk Storage Bin A2',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-DAL > Zone A > Aisle 1 > Bin 02',
    isActive: true,
  });

  pickBinA = await Location.create({
    warehouse: warehouseA._id,
    code: 'FP-01-01',
    name: 'Forward Picking Bin 01',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.PICKING,
    path: 'WH-DAL > Zone FP > Aisle 1 > Bin 01',
    isActive: true,
  });

  binB1 = await Location.create({
    warehouse: warehouseB._id,
    code: 'B-01-01',
    name: 'Houston Inbound Receiving Bin',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-HOU > Zone B > Aisle 1 > Bin 01',
    isActive: true,
  });

  const cat = await Category.create({ name: 'Transfers Category', code: 'TR-CAT' });
  const unit = await Unit.create({ name: 'Each', code: 'EA' });

  productItem = await Product.create({
    sku: 'SKU-TRANS-01',
    name: 'Industrial Widget Alpha',
    category: cat._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    isActive: true,
  });

  // Seed initial stock in binA1: 100 units
  await postMovements({
    movements: [
      {
        warehouse: warehouseA._id.toString(),
        location: binA1._id.toString(),
        product: productItem._id.toString(),
        quantity: 100,
        movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
        referenceType: 'GoodsReceipt',
        referenceId: new mongoose.Types.ObjectId().toString(),
        referenceNo: 'GRN-INIT-001',
        lineId: 'line-1',
        reason: 'Initial test inventory seeding',
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

describe('Phase 9 - Intra-Warehouse Direct Bin Relocations', () => {
  it('relocates inventory directly between two bins in the same warehouse atomically', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/direct')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        product: productItem._id.toString(),
        sourceLocation: binA1._id.toString(),
        destinationLocation: binA2._id.toString(),
        quantity: 30,
        notes: 'Relocating overflow stock to bin A2',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const sourceBalance = await StockBalance.findOne({
      warehouse: warehouseA._id,
      location: binA1._id,
      product: productItem._id,
    });
    expect(sourceBalance.onHand).toBe(70);
    expect(sourceBalance.available).toBe(70);

    const destBalance = await StockBalance.findOne({
      warehouse: warehouseA._id,
      location: binA2._id,
      product: productItem._id,
    });
    expect(destBalance.onHand).toBe(30);
    expect(destBalance.available).toBe(30);

    // Verify ledger postings
    const outEntry = await StockLedgerEntry.findOne({
      warehouse: warehouseA._id,
      location: binA1._id,
      movementType: MOVEMENT_TYPES.TRANSFER_OUT,
    });
    expect(outEntry).toBeTruthy();
    expect(outEntry.quantity).toBe(-30);

    const inEntry = await StockLedgerEntry.findOne({
      warehouse: warehouseA._id,
      location: binA2._id,
      movementType: MOVEMENT_TYPES.TRANSFER_IN,
    });
    expect(inEntry).toBeTruthy();
    expect(inEntry.quantity).toBe(30);
  });

  it('rejects direct relocation when source and destination locations are identical', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/direct')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        product: productItem._id.toString(),
        sourceLocation: binA1._id.toString(),
        destinationLocation: binA1._id.toString(),
        quantity: 10,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('rejects direct relocation when requested quantity exceeds available stock', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/direct')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        product: productItem._id.toString(),
        sourceLocation: binA1._id.toString(),
        destinationLocation: binA2._id.toString(),
        quantity: 9999,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Phase 9 - Inter-Warehouse Transfer Order Transit Lifecycle', () => {
  let transferOrderId;

  it('creates an inter-warehouse transfer order in PENDING_DISPATCH state', async () => {
    const res = await request(app)
      .post('/api/v1/transfers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        transferType: TRANSFER_TYPES.INTER_WAREHOUSE,
        originWarehouse: warehouseA._id.toString(),
        destinationWarehouse: warehouseB._id.toString(),
        carrier: 'Freight Express',
        trackingNumber: 'TRK-987654',
        notes: 'Monthly distribution replenishment',
        items: [
          {
            product: productItem._id.toString(),
            requestedQty: 25,
            sourceLocation: binA1._id.toString(),
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transferNumber).toMatch(/^TO-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe(TRANSFER_STATUSES.PENDING_DISPATCH);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].requestedQty).toBe(25);

    transferOrderId = res.body.data._id;
  });

  it('dispatches the transfer order, posting TRANSFER_OUT at origin and setting status to IN_TRANSIT', async () => {
    const res = await request(app)
      .post(`/api/v1/transfers/${transferOrderId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        carrier: 'Freight Express Logistics',
        trackingNumber: 'TRK-987654-CONFIRMED',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(TRANSFER_STATUSES.IN_TRANSIT);
    expect(res.body.data.dispatchedAt).toBeTruthy();

    // Source bin binA1: 70 - 25 = 45
    const sourceBal = await StockBalance.findOne({
      warehouse: warehouseA._id,
      location: binA1._id,
      product: productItem._id,
    });
    expect(sourceBal.onHand).toBe(45);
  });

  it('receives the transfer order at destination warehouse, posting TRANSFER_IN and setting status to COMPLETED', async () => {
    const orderRes = await request(app)
      .get(`/api/v1/transfers/${transferOrderId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const item = orderRes.body.data.items[0];

    const res = await request(app)
      .post(`/api/v1/transfers/${transferOrderId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            itemId: item._id,
            receivedQty: 25,
            destinationLocationId: binB1._id.toString(),
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(TRANSFER_STATUSES.COMPLETED);
    expect(res.body.data.receivedAt).toBeTruthy();

    // Destination bin binB1 should now have 25 on hand
    const destBal = await StockBalance.findOne({
      warehouse: warehouseB._id,
      location: binB1._id,
      product: productItem._id,
    });
    expect(destBal).toBeTruthy();
    expect(destBal.onHand).toBe(25);
    expect(destBal.available).toBe(25);
  });
});

describe('Phase 9 - Replenishment Rules & Need Evaluation Engine', () => {
  it('configures a min/max replenishment rule for a forward pick bin', async () => {
    const res = await request(app)
      .post('/api/v1/transfers/replenishment/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        product: productItem._id.toString(),
        location: pickBinA._id.toString(),
        minQuantity: 20,
        maxQuantity: 100,
        isActive: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.minQuantity).toBe(20);
    expect(res.body.data.maxQuantity).toBe(100);
  });

  it('lists configured replenishment rules', async () => {
    const res = await request(app)
      .get(`/api/v1/transfers/replenishment/rules?warehouse=${warehouseA._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].minQuantity).toBe(20);
  });

  it('evaluates replenishment needs and identifies deficit and reserve bins', async () => {
    // Pick bin pickBinA has 0 on hand, min is 20, max is 100 => deficit is 100
    // Reserve bins (binA1 has 45, binA2 has 30) should be suggested
    const res = await request(app)
      .get(`/api/v1/transfers/replenishment/evaluate/${warehouseA._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const suggestion = res.body.data[0];
    expect(suggestion.status).toBe('CRITICAL_STOCKOUT');
    expect(suggestion.currentOnHand).toBe(0);
    expect(suggestion.deficitQuantity).toBe(100);
    expect(suggestion.reserveBins.length).toBeGreaterThanOrEqual(1);
    expect(suggestion.totalReserveAvailable).toBe(75); // 45 in binA1 + 30 in binA2
  });
});
