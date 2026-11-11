/**
 * StockPilot WMS - Outbound Operations Integration Tests.
 *
 * Verifies sales order lifecycles, FEFO/FIFO stock allocation, pick wave generation,
 * item pick confirmations, and final shipment dispatch with stock ledger integration.
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
import { Customer } from '../src/modules/customers/customer.model.js';
import { SalesOrder, SO_STATUSES } from '../src/modules/outbound/salesOrder.model.js';
import { PICK_STATUSES, PICK_ITEM_STATUSES } from '../src/modules/outbound/pickList.model.js';
import { SHIPMENT_STATUSES } from '../src/modules/outbound/shipment.model.js';
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { Batch } from '../src/modules/inventory/batch.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let replSet;
let adminUser;
let adminToken;
let warehouse;
let pickingBin;
let storageBin;
let packingStaging;
let customer;
let productStd;
let productBatch;
let earlyBatch;
let laterBatch;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Outbound Logistics Admin',
    email: 'outbound.admin@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
  });

  warehouse = await Warehouse.create({
    name: 'Fulfillment Hub North',
    code: 'WH-FLN',
    type: 'DISTRIBUTION_CENTER',
    isActive: true,
  });

  pickingBin = await Location.create({
    warehouse: warehouse._id,
    name: 'Pick Bin P-01',
    code: 'BIN-P01',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.PICKING,
    path: 'WH-FLN/AISLE-01/BIN-P01',
    isActive: true,
  });

  storageBin = await Location.create({
    warehouse: warehouse._id,
    name: 'Storage Bin S-01',
    code: 'BIN-S01',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'WH-FLN/AISLE-02/BIN-S01',
    isActive: true,
  });

  packingStaging = await Location.create({
    warehouse: warehouse._id,
    name: 'Packing Station 01',
    code: 'PACKING-01',
    type: LOCATION_TYPES.ZONE,
    purpose: LOCATION_PURPOSES.PACKING,
    path: 'WH-FLN/PACKING-01',
    isActive: true,
  });

  const category = await Category.create({ name: 'Consumables', code: 'CNS', isActive: true });
  const unitPcs = await Unit.create({ name: 'Pieces', code: 'PCS', allowDecimals: false, isActive: true });

  customer = await Customer.create({
    name: 'Apex Industrial Corp',
    code: 'CUST-APEX',
    email: 'purchasing@apexind.com',
    isActive: true,
    address: {
      street: '100 Industrial Parkway',
      city: 'Detroit',
      state: 'MI',
      postalCode: '48201',
      country: 'US',
    },
  });

  productStd = await Product.create({
    sku: 'WRENCH-10MM',
    name: 'Combination Wrench 10mm',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.NONE,
    costPriceMinor: 450,
    salePriceMinor: 1200,
    isActive: true,
  });

  productBatch = await Product.create({
    sku: 'LUBRICANT-500ML',
    name: 'Synthetic Machine Lubricant',
    category: category._id,
    unit: unitPcs._id,
    trackingType: TRACKING_TYPES.BATCH,
    costPriceMinor: 800,
    salePriceMinor: 2500,
    isActive: true,
  });

  earlyBatch = await Batch.create({
    product: productBatch._id,
    batchNumber: 'LOT-EXP-2027',
    expiresOn: new Date('2027-01-01'),
  });

  laterBatch = await Batch.create({
    product: productBatch._id,
    batchNumber: 'LOT-EXP-2028',
    expiresOn: new Date('2028-12-31'),
  });

  // Seed inventory balances
  await StockBalance.create([
    {
      product: productStd._id,
      warehouse: warehouse._id,
      location: pickingBin._id,
      onHand: 100,
      reserved: 0,
    },
    {
      product: productBatch._id,
      warehouse: warehouse._id,
      location: storageBin._id,
      batch: laterBatch._id,
      onHand: 50,
      reserved: 0,
    },
    {
      product: productBatch._id,
      warehouse: warehouse._id,
      location: pickingBin._id,
      batch: earlyBatch._id,
      onHand: 30,
      reserved: 0,
    },
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

describe('Phase 7: Sales Order Capture & Allocation', () => {
  it('creates a draft sales order with line totals and pricing', async () => {
    const res = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        warehouse: warehouse._id.toString(),
        requestedDeliveryDate: '2026-12-01',
        notes: 'Priority customer delivery',
        taxMinor: 500,
        shippingMinor: 1500,
        items: [
          {
            product: productStd._id.toString(),
            orderedQty: 10,
            unitPriceMinor: 1200,
          },
          {
            product: productBatch._id.toString(),
            orderedQty: 5,
            unitPriceMinor: 2500,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(SO_STATUSES.DRAFT);
    expect(res.body.data.items).toHaveLength(2);
    // Subtotal: 10 * 1200 (12000) + 5 * 2500 (12500) = 24500
    expect(res.body.data.subtotalMinor).toBe(24500);
    // Total: 24500 + 500 + 1500 = 26500
    expect(res.body.data.totalMinor).toBe(26500);
  });

  it('confirms sales order and automatically executes FEFO allocation', async () => {
    const createRes = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productBatch._id.toString(),
            orderedQty: 20,
            unitPriceMinor: 2500,
          },
        ],
      });

    const soId = createRes.body.data._id;

    const confirmRes = await request(app)
      .post(`/api/v1/sales-orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.status).toBe(SO_STATUSES.ALLOCATED);

    const allocatedLine = confirmRes.body.data.items[0];
    expect(allocatedLine.allocatedQty).toBe(20);
    expect(allocatedLine.allocations).toHaveLength(1);
    // Should prioritize earlyBatch (expires 2027) via FEFO
    expect(allocatedLine.allocations[0].batch._id.toString()).toBe(earlyBatch._id.toString());
    expect(allocatedLine.allocations[0].quantity).toBe(20);

    // Verify StockBalance.reserved was incremented atomically
    const earlyBalance = await StockBalance.findOne({
      warehouse: warehouse._id,
      product: productBatch._id,
      batch: earlyBatch._id,
    });
    expect(earlyBalance.reserved).toBe(20);
    expect(earlyBalance.onHand).toBe(30);
  });
});

describe('Phase 7: Wave / Pick List Execution', () => {
  it('creates optimized pick list and completes picking tasks', async () => {
    // Create and confirm a sales order
    const orderRes = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productStd._id.toString(),
            orderedQty: 15,
            unitPriceMinor: 1200,
          },
        ],
      });

    const soId = orderRes.body.data._id;
    await request(app)
      .post(`/api/v1/sales-orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Create Pick List
    const pickRes = await request(app)
      .post('/api/v1/pick-lists')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouse._id.toString(),
        salesOrderIds: [soId],
        stagingLocationId: packingStaging._id.toString(),
      });

    expect(pickRes.status).toBe(201);
    const pickList = pickRes.body.data;
    expect(pickList.status).toBe(PICK_STATUSES.PENDING);
    expect(pickList.items).toHaveLength(1);
    const pickItem = pickList.items[0];
    expect(pickItem.quantity).toBe(15);
    expect(pickItem.status).toBe(PICK_ITEM_STATUSES.PENDING);

    // Start picking
    const startRes = await request(app)
      .post(`/api/v1/pick-lists/${pickList._id}/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe(PICK_STATUSES.IN_PROGRESS);

    // Confirm picked item
    const confirmItemRes = await request(app)
      .post(`/api/v1/pick-lists/${pickList._id}/items/${pickItem._id}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pickedQty: 15,
      });

    expect(confirmItemRes.status).toBe(200);
    expect(confirmItemRes.body.data.status).toBe(PICK_STATUSES.COMPLETED);
    expect(confirmItemRes.body.data.items[0].status).toBe(PICK_ITEM_STATUSES.PICKED);

    // Check sales order updated to PACKED
    const updatedOrder = await SalesOrder.findById(soId);
    expect(updatedOrder.status).toBe(SO_STATUSES.PACKED);
    expect(updatedOrder.items[0].pickedQty).toBe(15);
  });
});

describe('Phase 7: Packing & Shipping Dispatch Integration', () => {
  it('creates shipment and dispatches, posting SALES_ISSUE and clearing reservations', async () => {
    const productShip = await Product.create({
      sku: 'DRILL-CORDLESS-18V',
      name: 'Cordless Power Drill 18V',
      category: (await Category.findOne())._id,
      unit: (await Unit.findOne())._id,
      trackingType: TRACKING_TYPES.NONE,
      costPriceMinor: 3500,
      salePriceMinor: 8900,
      isActive: true,
    });

    await StockBalance.create({
      product: productShip._id,
      warehouse: warehouse._id,
      location: pickingBin._id,
      onHand: 100,
      reserved: 0,
    });

    // 1. Create and confirm order
    const soRes = await request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customer: customer._id.toString(),
        warehouse: warehouse._id.toString(),
        items: [
          {
            product: productShip._id.toString(),
            orderedQty: 25,
            unitPriceMinor: 8900,
          },
        ],
      });

    const soId = soRes.body.data._id;
    await request(app)
      .post(`/api/v1/sales-orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Balance before dispatch: 100 onHand, 25 reserved
    const balBefore = await StockBalance.findOne({
      warehouse: warehouse._id,
      product: productShip._id,
      location: pickingBin._id,
    });
    expect(balBefore.onHand).toBe(100);
    expect(balBefore.reserved).toBe(25);

    // 2. Create Shipment
    const shpRes = await request(app)
      .post('/api/v1/shipments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        salesOrder: soId,
        carrier: 'FedEx Freight',
        trackingNumber: 'FDX-99882211',
        packages: [
          {
            packageNumber: 'BOX-01',
            weightKg: 5.4,
            boxType: 'MEDIUM_CARTON',
          },
        ],
      });

    expect(shpRes.status).toBe(201);
    const shipmentId = shpRes.body.data._id;

    // 3. Dispatch Shipment
    const dispatchRes = await request(app)
      .post(`/api/v1/shipments/${shipmentId}/dispatch`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        carrier: 'FedEx Freight',
        trackingNumber: 'FDX-99882211',
      });

    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe(SHIPMENT_STATUSES.DISPATCHED);
    expect(dispatchRes.body.data.dispatchedAt).toBeTruthy();

    // 4. Verify StockBalance updated: onHand decreased by 25, reserved decreased by 25
    const balAfter = await StockBalance.findOne({
      warehouse: warehouse._id,
      product: productShip._id,
      location: pickingBin._id,
    });
    expect(balAfter.onHand).toBe(75);
    expect(balAfter.reserved).toBe(0);

    // 5. Verify immutable StockLedgerEntry posted
    const ledgerEntry = await StockLedgerEntry.findOne({
      referenceType: 'SALES_ORDER',
      referenceId: soId,
      movementType: MOVEMENT_TYPES.SALES_ISSUE,
    });
    expect(ledgerEntry).toBeTruthy();
    expect(ledgerEntry.quantity).toBe(-25);
    expect(ledgerEntry.balanceAfter).toBe(75);

    // 6. Verify SalesOrder updated to SHIPPED
    const finalOrder = await SalesOrder.findById(soId);
    expect(finalOrder.status).toBe(SO_STATUSES.SHIPPED);
    expect(finalOrder.items[0].shippedQty).toBe(25);
  });
});
