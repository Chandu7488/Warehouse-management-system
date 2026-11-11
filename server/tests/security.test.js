/**
 * StockPilot WMS - Production Security & Vulnerability Audit Integration Tests.
 *
 * Verifies NoSQL injection resistance, strict RBAC authorization matrix,
 * unauthenticated rejection, security response headers, and barcode lookup security.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Product, TRACKING_TYPES } from '../src/modules/products/product.model.js';
import { Category } from '../src/modules/categories/category.model.js';
import { Unit } from '../src/modules/units/unit.model.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let replSet;
let adminUser;
let adminToken;
let operatorUser;
let operatorToken;
let testProduct;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  adminUser = await User.create({
    name: 'SecOps Administrator',
    email: 'secops.admin@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.ADMIN,
    isActive: true,
  });

  adminToken = generateAccessToken({
    id: adminUser._id.toString(),
    role: ROLES.ADMIN,
    email: adminUser.email,
  });

  operatorUser = await User.create({
    name: 'Warehouse Operator',
    email: 'operator.user@stockpilot.local',
    passwordHash: '$2a$10$wT8v1FzD1.7qD.fKjB2jA.z9HhXw6iQ7h6rT6pQ5fL9mE5vS3v9w2',
    role: ROLES.OPERATOR,
    isActive: true,
  });

  operatorToken = generateAccessToken({
    id: operatorUser._id.toString(),
    role: ROLES.OPERATOR,
    email: operatorUser.email,
  });

  const category = await Category.create({
    code: 'SEC-CAT',
    name: 'Security Hardware',
    isActive: true,
  });

  const unit = await Unit.create({
    code: 'EA',
    name: 'Each',
    symbol: 'ea',
    allowDecimals: false,
    isActive: true,
  });

  testProduct = await Product.create({
    sku: 'SEC-LOCK-01',
    name: 'High Security Smart Lock',
    barcode: '0799439112233',
    category: category._id,
    unit: unit._id,
    trackingType: TRACKING_TYPES.NONE,
    reorderLevel: 5,
    reorderQuantity: 20,
    costPriceMinor: 8000,
    salePriceMinor: 14000,
    isActive: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replSet) {
    await replSet.stop();
  }
});

describe('Security & Hardening - NoSQL Injection Prevention', () => {
  it('blocks NoSQL injection payload in login credentials with HTTP 422 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: { $ne: null },
        password: { $gt: '' },
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('blocks NoSQL injection in JSON body for creation endpoints', async () => {
    const res = await request(app)
      .post('/api/v1/categories')
      .send({
        name: { $ne: null },
        code: { $gt: '' },
      })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

describe('Security & Hardening - Authentication Enforcement', () => {
  it('rejects unauthenticated requests to protected endpoints with HTTP 401', async () => {
    const endpoints = [
      '/api/v1/users',
      '/api/v1/products',
      '/api/v1/warehouses',
      '/api/v1/inventory/ledger',
      '/api/v1/purchase-orders',
      '/api/v1/sales-orders',
      '/api/v1/transfers',
      '/api/v1/counts',
      '/api/v1/adjustments',
      '/api/v1/reports/dashboard',
    ];

    for (const url of endpoints) {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  it('rejects tampered or malformed JWT access tokens with HTTP 401', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', 'Bearer invalid.tampered.token');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Security & Hardening - Role-Based Access Control (RBAC) Enforcement', () => {
  it('denies Operator role access to Admin-only user management endpoints with HTTP 403', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('permits Admin role to access protected executive reports', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Security & Hardening - Security Headers & Protection Baseline', () => {
  it('serves secure HTTP headers via Helmet middleware', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
    expect(res.headers['x-download-options']).toBe('noopen');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('Security & Hardening - Product Barcode & SKU Lookup Endpoint', () => {
  it('looks up an active product by exact SKU code', async () => {
    const res = await request(app)
      .get(`/api/v1/products/lookup?code=${testProduct.sku}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku).toBe(testProduct.sku);
    expect(res.body.data.name).toBe(testProduct.name);
  });

  it('looks up an active product by exact barcode', async () => {
    const res = await request(app)
      .get(`/api/v1/products/lookup?code=${testProduct.barcode}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sku).toBe(testProduct.sku);
  });

  it('returns HTTP 404 for unknown barcode or SKU', async () => {
    const res = await request(app)
      .get('/api/v1/products/lookup?code=UNKNOWN-CODE-999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
