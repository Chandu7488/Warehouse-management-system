/**
 * StockPilot WMS - Returns & Reverse Logistics Integration Tests.
 *
 * Verifies RMA creation, dock receiving, quality inspection grading,
 * restock ledger posting, quarantine routing, and supplier returns.
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
import { Supplier } from '../src/modules/suppliers/supplier.model.js';
import {
  RETURN_TYPES,
  RMA_STATUSES,
  DISPOSITION_TYPES,
  ITEM_CONDITIONS,
} from '../src/modules/returns/returnOrder.model.js';
import { StockBalance } from '../src/modules/inventory/stockBalance.model.js';
import { StockLedgerEntry, MOVEMENT_TYPES } from '../src/modules/inventory/stockLedgerEntry.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';
import { postMovements } from '../src/modules/inventory/stockPosting.service.js';

let replSet;
let adminUser;
let adminToken;
let warehouse;
let storageBin;
let quarantineBin;
let customer;
let supplier;
let productItem;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'Returns Manager',
    email: 'returns.manager@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });

  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
  });

  warehouse = await Warehouse.create({
    code: 'WH-RET',
    name: 'Returns Test Facility',
    address: { line1: '400 Reverse Way', city: 'Dallas', state: 'TX', postalCode: '75201', country: 'US' },
  });

  storageBin = await Location.create({
    warehouse: warehouse._id,
    code: 'BIN-RET-01',
    name: 'Restock Storage Bin 01',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.STORAGE,
    path: 'Aisle 01 > Rack A > Shelf 01 > Bin 01',
  });

  quarantineBin = await Location.create({
    warehouse: warehouse._id,
    code: 'QUAR-01',
    name: 'Quarantine Holding Bin',
    type: LOCATION_TYPES.BIN,
    purpose: LOCATION_PURPOSES.QUARANTINE,
    path: 'Aisle Q > Rack 01 > Bin 01',
  });

  const category = await Category.create({ name: 'Hardware', code: 'HW' });
  const unit = await Unit.create({ name: 'Pieces', code: 'PCS' });

  customer = await Customer.create({
    name: 'OmniCorp Industrial',
    code: 'CUST-OMNI',
    email: 'returns@omnicorp.local',
  });

  supplier = await Supplier.create({
    name: 'Precision Parts Ltd',
    code: 'SUP-PREC',
    email: 'orders@precisionparts.local',
  });

  productItem = await Product.create({
    sku: 'WIDGET-PRO-100',
    name: 'Widget Pro 100',
    category: category._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    salePriceMinor: 2500,
    costPriceMinor: 1500,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

describe('Phase 8: Reverse Logistics & RMA Management Integration', () => {
  let customerRmaId;
  let customerRmaItemId;

  it('creates a customer return authorization (RMA) in PENDING_RECEIPT status', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnType: RETURN_TYPES.CUSTOMER_RETURN,
        warehouse: warehouse._id.toString(),
        customer: customer._id.toString(),
        trackingNumber: 'RET-TRACK-991',
        notes: 'Customer reported minor packaging damage on arrival',
        items: [
          {
            product: productItem._id.toString(),
            expectedQty: 5,
            condition: ITEM_CONDITIONS.NEW,
            reason: 'TRANSIT_DAMAGE',
            reasonNotes: 'Cardboard carton crushed in courier transit',
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rmaNumber).toMatch(/^RMA-\d{4}-\d{4}$/);
    expect(res.body.data.status).toBe(RMA_STATUSES.PENDING_RECEIPT);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].expectedQty).toBe(5);

    customerRmaId = res.body.data._id;
    customerRmaItemId = res.body.data.items[0]._id;
  });

  it('records dock receiving intake for the customer RMA', async () => {
    const res = await request(app)
      .post(`/api/v1/returns/${customerRmaId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            itemId: customerRmaItemId,
            receivedQty: 5,
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(RMA_STATUSES.RECEIVED);
    expect(res.body.data.items[0].receivedQty).toBe(5);
    expect(res.body.data.receivedAt).toBeDefined();
  });

  it('processes QA inspection and restocks goods into inventory ledger', async () => {
    const res = await request(app)
      .post(`/api/v1/returns/${customerRmaId}/disposition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            itemId: customerRmaItemId,
            disposition: DISPOSITION_TYPES.RESTOCK,
            condition: ITEM_CONDITIONS.LIKE_NEW,
            targetLocationId: storageBin._id.toString(),
            inspectedQty: 5,
            notes: 'Product sealed, only packaging outer sleeve was damaged. Approved for resale.',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe(RMA_STATUSES.COMPLETED);
    expect(res.body.data.completedAt).toBeDefined();

    // Verify stock balance in destination storage bin
    const balance = await StockBalance.findOne({
      product: productItem._id,
      location: storageBin._id,
    });
    expect(balance).toBeDefined();
    expect(balance.onHand).toBe(5);
    expect(balance.available).toBe(5);

    // Verify immutable StockLedgerEntry
    const ledger = await StockLedgerEntry.findOne({
      referenceId: customerRmaId.toString(),
      movementType: MOVEMENT_TYPES.CUSTOMER_RETURN,
    });
    expect(ledger).toBeDefined();
    expect(ledger.quantity).toBe(5);
    expect(ledger.location.toString()).toBe(storageBin._id.toString());
  });

  it('routes defective returns into quarantine holding bin', async () => {
    const createRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnType: RETURN_TYPES.CUSTOMER_RETURN,
        warehouse: warehouse._id.toString(),
        customer: customer._id.toString(),
        items: [
          {
            product: productItem._id.toString(),
            expectedQty: 2,
            condition: ITEM_CONDITIONS.DEFECTIVE,
            reason: 'DEFECTIVE_PRODUCT',
          },
        ],
      });

    const rmaId = createRes.body.data._id;
    const itemId = createRes.body.data.items[0]._id;

    await request(app)
      .post(`/api/v1/returns/${rmaId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ itemId, receivedQty: 2 }] });

    const dispRes = await request(app)
      .post(`/api/v1/returns/${rmaId}/disposition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            itemId,
            disposition: DISPOSITION_TYPES.QUARANTINE,
            targetLocationId: quarantineBin._id.toString(),
            inspectedQty: 2,
            notes: 'Requires technical QA inspection',
          },
        ],
      });

    expect(dispRes.status).toBe(200);
    expect(dispRes.body.data.status).toBe(RMA_STATUSES.COMPLETED);

    const quarBal = await StockBalance.findOne({
      product: productItem._id,
      location: quarantineBin._id,
    });
    expect(quarBal).toBeDefined();
    expect(quarBal.onHand).toBe(2);
  });

  it('handles supplier return (Return-to-Vendor) and deducts inventory from stock ledger', async () => {
    // 1. First, establish initial stock in storage bin (10 units)
    await postMovements({
      movements: [
        {
          movementType: MOVEMENT_TYPES.PURCHASE_RECEIPT,
          product: productItem._id,
          warehouse: warehouse._id,
          location: storageBin._id,
          quantity: 10,
          consumesReservation: false,
          referenceType: 'PURCHASE_ORDER',
          referenceId: 'PO-INIT-01',
          referenceNo: 'PO-INIT-01',
          lineId: '1',
          reason: 'Initial test stock intake',
        },
      ],
      actor: adminUser,
    });

    const balanceBefore = await StockBalance.findOne({
      product: productItem._id,
      location: storageBin._id,
    });
    expect(balanceBefore.onHand).toBe(15); // 5 from customer return + 10

    // 2. Create supplier return RMA for defective goods
    const createRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnType: RETURN_TYPES.SUPPLIER_RETURN,
        warehouse: warehouse._id.toString(),
        supplier: supplier._id.toString(),
        trackingNumber: 'SUP-RTV-101',
        notes: 'Recall batch batch return to vendor for vendor credit',
        items: [
          {
            product: productItem._id.toString(),
            expectedQty: 4,
            condition: ITEM_CONDITIONS.DEFECTIVE,
            reason: 'SUPPLIER_RECALL',
          },
        ],
      });

    expect(createRes.status).toBe(201);
    const supplierRmaId = createRes.body.data._id;
    const supplierItemId = createRes.body.data.items[0]._id;

    // 3. Receive at returns staging
    await request(app)
      .post(`/api/v1/returns/${supplierRmaId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [{ itemId: supplierItemId, receivedQty: 4 }],
      });

    // 4. Process disposition as RETURN_TO_VENDOR from storageBin
    const dispRes = await request(app)
      .post(`/api/v1/returns/${supplierRmaId}/disposition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            itemId: supplierItemId,
            disposition: DISPOSITION_TYPES.RETURN_TO_VENDOR,
            targetLocationId: storageBin._id.toString(),
            inspectedQty: 4,
            notes: 'Handed over to carrier for supplier credit',
          },
        ],
      });

    expect(dispRes.status).toBe(200);
    expect(dispRes.body.data.status).toBe(RMA_STATUSES.COMPLETED);

    // 5. Verify stock balance was decremented by 4
    const balanceAfter = await StockBalance.findOne({
      product: productItem._id,
      location: storageBin._id,
    });
    expect(balanceAfter.onHand).toBe(11); // 15 - 4

    // 6. Verify ledger has negative SUPPLIER_RETURN entry
    const rtvLedger = await StockLedgerEntry.findOne({
      referenceId: supplierRmaId.toString(),
      movementType: MOVEMENT_TYPES.SUPPLIER_RETURN,
    });
    expect(rtvLedger).toBeDefined();
    expect(rtvLedger.quantity).toBe(-4);
  });
});
