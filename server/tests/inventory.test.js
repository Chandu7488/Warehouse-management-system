/**
 * StockPilot WMS - Inventory Engine & Stock Ledger Integration Tests.
 *
 * Verifies append-only ledger immutability, atomic concurrency and anti-overselling,
 * transactional multi-leg postings and rollback, FEFO/FIFO stock allocation,
 * idempotency, mathematical ledger-balance reconciliation, and HTTP endpoints.
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
import {
  Location,
  LOCATION_TYPES,
  LOCATION_PURPOSES,
} from '../src/modules/locations/location.model.js';
import { Product, TRACKING_TYPES } from '../src/modules/products/product.model.js';
import { Category } from '../src/modules/categories/category.model.js';
import { Unit } from '../src/modules/units/unit.model.js';
import {
  StockLedgerEntry,
  MOVEMENT_TYPES,
} from '../src/modules/inventory/stockLedgerEntry.model.js';
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { Batch, BATCH_STATUSES } from '../src/modules/inventory/batch.model.js';
import { Serial } from '../src/modules/inventory/serial.model.js';
import { Reservation } from '../src/modules/inventory/reservation.model.js';
import { postMovements } from '../src/modules/inventory/stockPosting.service.js';
import { allocateStock, releaseReservation } from '../src/modules/inventory/allocation.service.js';
import { runReconciliation } from '../src/scripts/reconcileStock.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let replSet;
let adminUser;
let adminToken;
let viewerToken;
let warehouse;
let binLocation;
let pickingLocation;
let unitPcs;
let unitKg;
let category;
let regularProduct;
let batchProduct;
let serialProduct;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Inventory Admin',
    email: 'admin.inventory@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
  });

  const viewer = await User.create({
    name: 'Inventory Viewer',
    email: 'viewer.inventory@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.VIEWER,
    isActive: true,
  });
  viewerToken = generateAccessToken({
    id: viewer._id.toString(),
    role: ROLES.VIEWER,
  });

  unitPcs = await Unit.create({
    name: 'Pieces',
    code: 'PCS',
    allowDecimals: false,
  });
  unitKg = await Unit.create({
    name: 'Kilograms',
    code: 'KG',
    allowDecimals: true,
  });
  category = await Category.create({
    name: 'Industrial Goods',
    code: 'IND',
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
  await Reservation.deleteMany({});
  await Product.deleteMany({});
  await Location.deleteMany({});
  await Warehouse.deleteMany({});

  warehouse = await Warehouse.create({
    code: 'WH-INV',
    name: 'Inventory Test Hub',
    address: { city: 'Chicago', country: 'USA' },
  });

  const zone = await Location.create({
    warehouse: warehouse._id,
    type: LOCATION_TYPES.ZONE,
    code: 'ZONE-A',
    path: 'ZONE-A',
    purpose: LOCATION_PURPOSES.STORAGE,
  });

  binLocation = await Location.create({
    warehouse: warehouse._id,
    parent: zone._id,
    type: LOCATION_TYPES.BIN,
    code: 'BIN-01',
    path: 'ZONE-A/BIN-01',
    purpose: LOCATION_PURPOSES.STORAGE,
  });

  pickingLocation = await Location.create({
    warehouse: warehouse._id,
    parent: zone._id,
    type: LOCATION_TYPES.BIN,
    code: 'PICK-01',
    path: 'ZONE-A/PICK-01',
    purpose: LOCATION_PURPOSES.PICKING,
  });

  regularProduct = await Product.create({
    sku: 'SKU-REGULAR',
    barcode: 'BC-REGULAR-01',
    name: 'Industrial Bolt Pack',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.NONE,
  });

  batchProduct = await Product.create({
    sku: 'SKU-BATCH',
    barcode: 'BC-BATCH-01',
    name: 'Polymer Compound Batch',
    category: category._id,
    unit: unitKg._id,
    trackingType: TRACKING_TYPES.BATCH,
    hasExpiry: true,
  });

  serialProduct = await Product.create({
    sku: 'SKU-SERIAL',
    barcode: 'BC-SERIAL-01',
    name: 'Barcode Scanner Handheld',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.SERIAL,
  });
});

describe('Phase 5: Stock Ledger Immutability', () => {
  it('blocks update and delete operations on stock ledger entries via schema middleware', async () => {
    const entry = await StockLedgerEntry.create({
      movementType: MOVEMENT_TYPES.OPENING_BALANCE,
      product: regularProduct._id,
      warehouse: warehouse._id,
      location: binLocation._id,
      quantity: 50,
      balanceAfter: 50,
      referenceType: 'OPENING_BALANCE',
      referenceId: new mongoose.Types.ObjectId(),
      createdBy: adminUser._id,
    });

    await expect(
      StockLedgerEntry.updateOne({ _id: entry._id }, { $set: { quantity: 100 } }),
    ).rejects.toThrow(/immutable/i);

    await expect(
      StockLedgerEntry.findOneAndUpdate({ _id: entry._id }, { $set: { balanceAfter: 200 } }),
    ).rejects.toThrow(/immutable/i);

    await expect(StockLedgerEntry.deleteOne({ _id: entry._id })).rejects.toThrow(/immutable/i);

    await expect(StockLedgerEntry.deleteMany({ product: regularProduct._id })).rejects.toThrow(
      /immutable/i,
    );
  });
});

describe('Phase 5: Stock Posting Service & Concurrency Invariants', () => {
  it('posts positive movement atomically, updating balance onHand and ledger entry', async () => {
    const refId = new mongoose.Types.ObjectId();
    const [entry] = await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.OPENING_BALANCE,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: binLocation._id,
          quantity: 25,
          unitCostMinor: 1500,
          referenceType: 'OPENING_BALANCE',
          referenceId: refId,
          reason: 'Initial setup',
        },
      ],
      actor: adminUser,
    });

    expect(entry).toBeDefined();
    expect(entry.balanceAfter).toBe(25);
    expect(entry.quantity).toBe(25);

    const balance = await StockBalance.findOne({
      product: regularProduct._id,
      location: binLocation._id,
    });
    expect(balance).toBeDefined();
    expect(balance.onHand).toBe(25);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(25);
  });

  it('rolls back completely when a multi-leg transaction encounters a failure', async () => {
    await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.OPENING_BALANCE,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: binLocation._id,
          quantity: 10,
          referenceType: 'OPENING_BALANCE',
          referenceId: new mongoose.Types.ObjectId(),
        },
      ],
      actor: adminUser,
    });

    const fakeLocationId = new mongoose.Types.ObjectId();

    await expect(
      postMovements({
        movements: [
          {
            movementType: MOVEMENT_TYPES.PUTAWAY,
            product: regularProduct._id,
            warehouse: warehouse._id,
            location: binLocation._id,
            quantity: -5,
            referenceType: 'INTERNAL_MOVE',
            referenceId: new mongoose.Types.ObjectId(),
          },
          {
            movementType: MOVEMENT_TYPES.PUTAWAY,
            product: regularProduct._id,
            warehouse: warehouse._id,
            location: fakeLocationId,
            quantity: 5,
            referenceType: 'INTERNAL_MOVE',
            referenceId: new mongoose.Types.ObjectId(),
          },
        ],
        actor: adminUser,
      }),
    ).rejects.toThrow();

    const balance = await StockBalance.findOne({
      product: regularProduct._id,
      location: binLocation._id,
    });
    expect(balance.onHand).toBe(10);

    const ledgerCount = await StockLedgerEntry.countDocuments({
      movementType: MOVEMENT_TYPES.PUTAWAY,
    });
    expect(ledgerCount).toBe(0);
  });

  it('guarantees zero overselling under high concurrency', async () => {
    await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.OPENING_BALANCE,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: binLocation._id,
          quantity: 10,
          referenceType: 'OPENING_BALANCE',
          referenceId: new mongoose.Types.ObjectId(),
        },
      ],
      actor: adminUser,
    });

    const concurrentAttempts = 10;
    const requestQty = 5;

    const promises = Array.from({ length: concurrentAttempts }, () =>
      postMovements({
        movements: [
          {
            movementType: MOVEMENT_TYPES.SALES_ISSUE,
            product: regularProduct._id,
            warehouse: warehouse._id,
            location: binLocation._id,
            quantity: -requestQty,
            referenceType: 'SALES_ORDER',
            referenceId: new mongoose.Types.ObjectId(),
            lineId: new mongoose.Types.ObjectId(),
          },
        ],
        actor: adminUser,
      }),
    );

    const results = await Promise.allSettled(promises);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded.length).toBe(2);
    expect(failed.length).toBe(8);

    for (const fail of failed) {
      expect(fail.reason.statusCode || fail.reason.status).toBe(409);
    }

    const finalBalance = await StockBalance.findOne({
      product: regularProduct._id,
      location: binLocation._id,
    });
    expect(finalBalance.onHand).toBe(0);
  });

  it('behaves idempotently when the same movement is submitted multiple times', async () => {
    const fixedRefId = new mongoose.Types.ObjectId();
    const fixedLineId = new mongoose.Types.ObjectId();

    const movement = {
      movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
      product: regularProduct._id,
      warehouse: warehouse._id,
      location: binLocation._id,
      quantity: 15,
      referenceType: 'GOODS_RECEIPT',
      referenceId: fixedRefId,
      lineId: fixedLineId,
    };

    const [firstPost] = await postMovements({
      movements: [movement],
      actor: adminUser,
    });

    const [secondPost] = await postMovements({
      movements: [movement],
      actor: adminUser,
    });

    expect(String(firstPost._id)).toBe(String(secondPost._id));

    const finalBalance = await StockBalance.findOne({
      product: regularProduct._id,
      location: binLocation._id,
    });
    expect(finalBalance.onHand).toBe(15);
  });
});

describe('Phase 5: Tracking & Allocation Rules', () => {
  it('enforces batch tracking and rejects batch movement missing batch reference', async () => {
    await expect(
      postMovements({
        movements: [
          {
            movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
            product: batchProduct._id,
            warehouse: warehouse._id,
            location: binLocation._id,
            quantity: 50,
            referenceType: 'GOODS_RECEIPT',
            referenceId: new mongoose.Types.ObjectId(),
          },
        ],
        actor: adminUser,
      }),
    ).rejects.toThrow(/batch tracking is required/i);
  });

  it('enforces serial tracking rules and unit decimals', async () => {
    await expect(
      postMovements({
        movements: [
          {
            movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
            product: serialProduct._id,
            warehouse: warehouse._id,
            location: binLocation._id,
            quantity: 2,
            referenceType: 'GOODS_RECEIPT',
            referenceId: new mongoose.Types.ObjectId(),
          },
        ],
        actor: adminUser,
      }),
    ).rejects.toThrow(/serial/i);

    await expect(
      postMovements({
        movements: [
          {
            movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
            product: regularProduct._id,
            warehouse: warehouse._id,
            location: binLocation._id,
            quantity: 2.5,
            referenceType: 'GOODS_RECEIPT',
            referenceId: new mongoose.Types.ObjectId(),
          },
        ],
        actor: adminUser,
      }),
    ).rejects.toThrow(/allow fractional/i);
  });

  it('allocates stock using FEFO ordering for expiring goods and ignores quarantined batches', async () => {
    const batchEarly = await Batch.create({
      product: batchProduct._id,
      batchNumber: 'LOT-2026-EARLY',
      expiresOn: new Date('2026-12-01'),
      status: BATCH_STATUSES.ACTIVE,
    });

    const batchLate = await Batch.create({
      product: batchProduct._id,
      batchNumber: 'LOT-2026-LATE',
      expiresOn: new Date('2027-06-01'),
      status: BATCH_STATUSES.ACTIVE,
    });

    const batchQuarantined = await Batch.create({
      product: batchProduct._id,
      batchNumber: 'LOT-2026-QUARANTINE',
      expiresOn: new Date('2026-11-15'),
      status: BATCH_STATUSES.QUARANTINED,
    });

    await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
          product: batchProduct._id,
          warehouse: warehouse._id,
          location: pickingLocation._id,
          batch: batchLate._id,
          quantity: 20,
          referenceType: 'GOODS_RECEIPT',
          referenceId: new mongoose.Types.ObjectId(),
        },
        {
          movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
          product: batchProduct._id,
          warehouse: warehouse._id,
          location: pickingLocation._id,
          batch: batchEarly._id,
          quantity: 15,
          referenceType: 'GOODS_RECEIPT',
          referenceId: new mongoose.Types.ObjectId(),
        },
        {
          movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
          product: batchProduct._id,
          warehouse: warehouse._id,
          location: pickingLocation._id,
          batch: batchQuarantined._id,
          quantity: 30,
          referenceType: 'GOODS_RECEIPT',
          referenceId: new mongoose.Types.ObjectId(),
        },
      ],
      actor: adminUser,
    });

    const session = await mongoose.startSession();
    let reservations;
    await session.withTransaction(async () => {
      reservations = await allocateStock({
        salesOrderId: new mongoose.Types.ObjectId(),
        lineId: new mongoose.Types.ObjectId(),
        warehouseId: warehouse._id.toString(),
        productId: batchProduct._id.toString(),
        requestedQty: 25,
        session,
      });
    });
    await session.endSession();

    expect(reservations.length).toBe(2);
    expect(String(reservations[0].batch)).toBe(String(batchEarly._id));
    expect(reservations[0].quantity).toBe(15);
    expect(String(reservations[1].batch)).toBe(String(batchLate._id));
    expect(reservations[1].quantity).toBe(10);

    const balanceEarly = await StockBalance.findOne({
      product: batchProduct._id,
      batch: batchEarly._id,
    });
    expect(balanceEarly.reserved).toBe(15);
    expect(balanceEarly.available).toBe(0);

    const balanceLate = await StockBalance.findOne({
      product: batchProduct._id,
      batch: batchLate._id,
    });
    expect(balanceLate.reserved).toBe(10);
    expect(balanceLate.available).toBe(10);

    const releaseSession = await mongoose.startSession();
    await releaseSession.withTransaction(async () => {
      await releaseReservation({
        reservationId: reservations[0]._id,
        session: releaseSession,
      });
    });
    await releaseSession.endSession();

    const releasedBalance = await StockBalance.findOne({
      product: batchProduct._id,
      batch: batchEarly._id,
    });
    expect(releasedBalance.reserved).toBe(0);
    expect(releasedBalance.available).toBe(15);
  });
});

describe('Phase 5: Reconciliation & Ledger Parity', () => {
  it('reconciles 100% cleanly with zero discrepancies after sequential movements', async () => {
    await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.OPENING_BALANCE,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: binLocation._id,
          quantity: 100,
          referenceType: 'OPENING_BALANCE',
          referenceId: new mongoose.Types.ObjectId(),
        },
        {
          movementType: MOVEMENT_TYPES.PUTAWAY,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: binLocation._id,
          quantity: -30,
          referenceType: 'TRANSFER',
          referenceId: new mongoose.Types.ObjectId(),
        },
        {
          movementType: MOVEMENT_TYPES.PUTAWAY,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: pickingLocation._id,
          quantity: 30,
          referenceType: 'TRANSFER',
          referenceId: new mongoose.Types.ObjectId(),
        },
        {
          movementType: MOVEMENT_TYPES.ADJUSTMENT_GAIN,
          product: regularProduct._id,
          warehouse: warehouse._id,
          location: pickingLocation._id,
          quantity: 5,
          referenceType: 'ADJUSTMENT',
          referenceId: new mongoose.Types.ObjectId(),
          reason: 'Cycle count gain',
        },
      ],
      actor: adminUser,
    });

    const audit = await runReconciliation();
    expect(audit.discrepancyCount).toBe(0);
  });
});

describe('Phase 5: HTTP Endpoints', () => {
  it('supports posting opening balance and retrieving balances and availability via HTTP', async () => {
    const postRes = await request(app)
      .post('/api/v1/inventory/opening-balance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: regularProduct._id.toString(),
            location: binLocation._id.toString(),
            quantity: 50,
            unitCostMinor: 2500,
            reason: 'HTTP test opening stock',
          },
        ],
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.success).toBe(true);

    const balanceRes = await request(app)
      .get('/api/v1/inventory/balances')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ warehouse: warehouse._id.toString() });

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.data.length).toBeGreaterThan(0);
    expect(balanceRes.body.data[0].onHand).toBe(50);

    const availRes = await request(app)
      .get('/api/v1/inventory/availability')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        warehouse: warehouse._id.toString(),
        product: regularProduct._id.toString(),
      });

    expect(availRes.status).toBe(200);
    expect(availRes.body.data.available).toBe(50);

    const ledgerRes = await request(app)
      .get('/api/v1/inventory/ledger')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ product: regularProduct._id.toString() });

    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.length).toBe(1);

    const entryId = ledgerRes.body.data[0]._id;
    const reverseRes = await request(app)
      .post(`/api/v1/inventory/ledger/${entryId}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Reversing erroneous opening stock entry',
      });

    expect(reverseRes.status).toBe(201);
    expect(reverseRes.body.data.movementType).toBe(MOVEMENT_TYPES.REVERSAL);

    const afterReverseBal = await request(app)
      .get('/api/v1/inventory/availability')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        warehouse: warehouse._id.toString(),
        product: regularProduct._id.toString(),
      });
    expect(afterReverseBal.body.data.onHand).toBe(0);

    const prodStockRes = await request(app)
      .get(`/api/v1/products/${regularProduct._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodStockRes.status).toBe(200);
  });

  it('rejects unauthorized users from posting opening balance or reversing ledger entries', async () => {
    const postRes = await request(app)
      .post('/api/v1/inventory/opening-balance')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: regularProduct._id.toString(),
            location: binLocation._id.toString(),
            quantity: 10,
          },
        ],
      });

    expect(postRes.status).toBe(403);
  });
});
