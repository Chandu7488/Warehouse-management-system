/**
 * StockPilot WMS - Master data integration tests.
 *
 * Verifies validation schemas, unique constraints, deactivation guards,
 * unit decimal constraints, and search/filtering across master data entities.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Category } from '../src/modules/categories/category.model.js';
import { Unit } from '../src/modules/units/unit.model.js';
import { Product, TRACKING_TYPES } from '../src/modules/products/product.model.js';
import { Supplier } from '../src/modules/suppliers/supplier.model.js';
import { Customer } from '../src/modules/customers/customer.model.js';
import { Warehouse } from '../src/modules/warehouses/warehouse.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let mongod;
let adminToken;
let clerkToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Master Admin',
    email: 'admin.master@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({ id: admin._id.toString(), role: ROLES.ADMIN });

  const clerk = await User.create({
    name: 'Stock Clerk',
    email: 'clerk.master@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.INVENTORY_CLERK,
    isActive: true,
  });
  clerkToken = generateAccessToken({ id: clerk._id.toString(), role: ROLES.INVENTORY_CLERK });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Category.deleteMany({});
  await Unit.deleteMany({});
  await Supplier.deleteMany({});
  await Customer.deleteMany({});
  await Warehouse.deleteMany({});
});

describe('Units of Measure', () => {
  it('creates a unit and enforces uppercase unique code', async () => {
    const res = await request(app)
      .post('/api/v1/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'pcs', name: 'Pieces', allowDecimals: false });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('PCS');

    const duplicateRes = await request(app)
      .post('/api/v1/units')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'PCS', name: 'Pieces duplicate' });

    expect(duplicateRes.status).toBe(409);
  });

  it('filters units by search query and pagination', async () => {
    await Unit.create({ code: 'BOX', name: 'Standard Box', allowDecimals: false });
    await Unit.create({ code: 'KG', name: 'Kilograms', allowDecimals: true });

    const res = await request(app)
      .get('/api/v1/units?search=kilo')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].code).toBe('KG');
    expect(res.body.meta.total).toBe(1);
  });
});

describe('Product Business Rules and Constraints', () => {
  it('rejects hasExpiry when trackingType is not BATCH', async () => {
    const cat = await Category.create({ name: 'Hardware' });
    const unit = await Unit.create({ code: 'PCS', name: 'Pieces', allowDecimals: false });

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'HW-001',
        name: 'Hammer',
        category: cat._id.toString(),
        unit: unit._id.toString(),
        trackingType: TRACKING_TYPES.NONE,
        hasExpiry: true,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects fractional reorder quantities when unit does not allow decimals', async () => {
    const cat = await Category.create({ name: 'Fasteners' });
    const unit = await Unit.create({ code: 'UNT', name: 'Countable Units', allowDecimals: false });

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'BOLT-100',
        name: 'Steel Bolt',
        category: cat._id.toString(),
        unit: unit._id.toString(),
        reorderLevel: 10.5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('does not allow fractional values');
  });

  it('allows fractional reorder quantities when unit allows decimals', async () => {
    const cat = await Category.create({ name: 'Bulk Materials' });
    const unit = await Unit.create({ code: 'KG', name: 'Kilograms', allowDecimals: true });

    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sku: 'SAND-01',
        name: 'Silica Sand',
        category: cat._id.toString(),
        unit: unit._id.toString(),
        reorderLevel: 25.75,
        reorderQuantity: 100.5,
        costPriceMinor: 1500,
        salePriceMinor: 2500,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.reorderLevel).toBe(25.75);
    expect(res.body.data.costPriceMinor).toBe(1500);
  });

  it('returns empty stock array for product stock endpoint', async () => {
    const cat = await Category.create({ name: 'Tools' });
    const unit = await Unit.create({ code: 'SET', name: 'Set', allowDecimals: false });
    const product = await Product.create({
      sku: 'TOOL-SET-1',
      name: 'Wrench Set',
      category: cat._id,
      unit: unit._id,
    });

    const res = await request(app)
      .get(`/api/v1/products/${product._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('Deactivation Guards', () => {
  it('blocks category deactivation when active products reference it', async () => {
    const cat = await Category.create({ name: 'Electronics' });
    const unit = await Unit.create({ code: 'EA', name: 'Each', allowDecimals: false });
    await Product.create({
      sku: 'ELEC-01',
      name: 'USB Cable',
      category: cat._id,
      unit: unit._id,
      isActive: true,
    });

    const res = await request(app)
      .delete(`/api/v1/categories/${cat._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain(
      'Cannot deactivate category: referenced by active products',
    );
  });

  it('blocks unit deactivation when active products reference it', async () => {
    const cat = await Category.create({ name: 'Packaging' });
    const unit = await Unit.create({ code: 'ROLL', name: 'Roll', allowDecimals: false });
    await Product.create({
      sku: 'TAPE-01',
      name: 'Duct Tape',
      category: cat._id,
      unit: unit._id,
      isActive: true,
    });

    const res = await request(app)
      .delete(`/api/v1/units/${unit._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain(
      'Cannot deactivate unit: referenced by active products',
    );
  });
});

describe('Partners and Warehouses', () => {
  it('creates suppliers and customers with unique codes', async () => {
    const supplierRes = await request(app)
      .post('/api/v1/suppliers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'SUP-001',
        name: 'Apex Industrial Supply',
        email: 'sales@apexind.com',
        paymentTermsDays: 30,
      });

    expect(supplierRes.status).toBe(201);
    expect(supplierRes.body.data.code).toBe('SUP-001');

    const customerRes = await request(app)
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'CUST-001',
        name: 'Global Retailers Inc',
        email: 'orders@globalretail.com',
      });

    expect(customerRes.status).toBe(201);
    expect(customerRes.body.data.code).toBe('CUST-001');
  });

  it('creates warehouse site and enforces unique uppercase code', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'wh-main',
        name: 'Primary Distribution Center',
        address: { city: 'Chicago', country: 'USA' },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('WH-MAIN');
  });

  it('forbids inventory clerk from writing warehouse master data', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${clerkToken}`)
      .send({
        code: 'WH-DENIED',
        name: 'Denied Warehouse',
      });

    expect(res.status).toBe(403);
  });
});
