/**
 * StockPilot WMS - Location integration tests.
 *
 * Verifies location hierarchy validation, materialized path derivation and cascading,
 * system location provisioning and protections, tree generation, and transactional
 * bulk rack/shelf/bin generation.
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
import { ensureSystemLocations } from '../src/modules/locations/location.service.js';
import { ROLES } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let replSet;
let adminToken;
let viewerToken;
let warehouseA;
let warehouseB;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  const admin = await User.create({
    name: 'Locations Admin',
    email: 'admin.locations@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.ADMIN,
    isActive: true,
  });
  adminToken = generateAccessToken({ id: admin._id.toString(), role: ROLES.ADMIN });

  const viewer = await User.create({
    name: 'Warehouse Viewer',
    email: 'viewer.locations@stockpilot.local',
    passwordHash: 'dummy',
    role: ROLES.VIEWER,
    isActive: true,
  });
  viewerToken = generateAccessToken({ id: viewer._id.toString(), role: ROLES.VIEWER });
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Location.deleteMany({});
  await Warehouse.deleteMany({});

  warehouseA = await Warehouse.create({
    code: 'WH-TEST-A',
    name: 'Warehouse Test Alpha',
    address: { city: 'Dallas', country: 'USA' },
  });
  await ensureSystemLocations(warehouseA._id);

  warehouseB = await Warehouse.create({
    code: 'WH-TEST-B',
    name: 'Warehouse Test Beta',
    address: { city: 'Atlanta', country: 'USA' },
  });
  await ensureSystemLocations(warehouseB._id);
});

describe('Warehouse System Locations Auto-Provisioning', () => {
  it('automatically creates standard system locations when a warehouse is created', async () => {
    const res = await request(app)
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'WH-AUTO-SYS',
        name: 'Auto System Warehouse',
      });

    expect(res.status).toBe(201);
    const newWhId = res.body.data.id;

    const systemLocs = await Location.find({ warehouse: newWhId, isSystem: true });
    expect(systemLocs).toHaveLength(5);

    const purposes = systemLocs.map((l) => l.purpose);
    expect(purposes).toContain(LOCATION_PURPOSES.RECEIVING);
    expect(purposes).toContain(LOCATION_PURPOSES.QUARANTINE);
    expect(purposes).toContain(LOCATION_PURPOSES.SHIPPING);
    expect(purposes).toContain(LOCATION_PURPOSES.DAMAGED);
    expect(purposes).toContain(LOCATION_PURPOSES.RETURNS);
  });

  it('protects system locations from deactivation or purpose modification', async () => {
    const sysLoc = await Location.findOne({
      warehouse: warehouseA._id,
      purpose: LOCATION_PURPOSES.RECEIVING,
      isSystem: true,
    });
    expect(sysLoc).toBeDefined();

    const deactRes = await request(app)
      .delete(`/api/v1/locations/${sysLoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deactRes.status).toBe(403);
    expect(deactRes.body.error.message).toMatch(/system location/i);

    const patchRes = await request(app)
      .patch(`/api/v1/locations/${sysLoc._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ purpose: LOCATION_PURPOSES.STORAGE });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.message).toMatch(/cannot modify the purpose of a system location/i);
  });
});

describe('Location Hierarchy and Materialized Path', () => {
  it('enforces strict parent-type rules across Zone, Rack, Shelf, and Bin', async () => {
    const invalidZoneRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: warehouseB._id.toString(),
        type: LOCATION_TYPES.ZONE,
        code: 'ZONE-INVALID',
      });

    expect(invalidZoneRes.status).toBe(422);

    const zoneRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: null,
        type: LOCATION_TYPES.ZONE,
        purpose: LOCATION_PURPOSES.STORAGE,
        code: 'ZONE-A',
      });

    expect(zoneRes.status).toBe(201);
    expect(zoneRes.body.data.path).toBe('ZONE-A');
    const zoneId = zoneRes.body.data.id;

    const invalidShelfRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: zoneId,
        type: LOCATION_TYPES.SHELF,
        code: 'SHELF-PREMATURE',
      });

    expect(invalidShelfRes.status).toBe(422);
    expect(invalidShelfRes.body.error.message).toMatch(/rack/i);

    const rackRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: zoneId,
        type: LOCATION_TYPES.RACK,
        purpose: LOCATION_PURPOSES.STORAGE,
        code: 'RACK-01',
      });

    expect(rackRes.status).toBe(201);
    expect(rackRes.body.data.path).toBe('ZONE-A/RACK-01');
    const rackId = rackRes.body.data.id;

    const shelfRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: rackId,
        type: LOCATION_TYPES.SHELF,
        purpose: LOCATION_PURPOSES.STORAGE,
        code: 'SHELF-01',
      });

    expect(shelfRes.status).toBe(201);
    expect(shelfRes.body.data.path).toBe('ZONE-A/RACK-01/SHELF-01');
    const shelfId = shelfRes.body.data.id;

    const binRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: shelfId,
        type: LOCATION_TYPES.BIN,
        purpose: LOCATION_PURPOSES.STORAGE,
        code: 'BIN-01',
      });

    expect(binRes.status).toBe(201);
    expect(binRes.body.data.path).toBe('ZONE-A/RACK-01/SHELF-01/BIN-01');
  });

  it('rejects cross-warehouse parenting', async () => {
    const zoneBRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseB._id.toString(),
        parent: null,
        type: LOCATION_TYPES.ZONE,
        code: 'ZONE-BETA',
      });
    expect(zoneBRes.status).toBe(201);

    const crossRackRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        parent: zoneBRes.body.data.id,
        type: LOCATION_TYPES.RACK,
        code: 'RACK-CROSS',
      });

    expect(crossRackRes.status).toBe(422);
    expect(crossRackRes.body.error.message).toMatch(/different warehouse/i);
  });

  it('cascades materialized path updates to all descendants when code changes', async () => {
    const zone = await Location.create({
      warehouse: warehouseA._id,
      parent: null,
      type: LOCATION_TYPES.ZONE,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'ZONE-X',
      path: 'ZONE-X',
    });

    const rack = await Location.create({
      warehouse: warehouseA._id,
      parent: zone._id,
      type: LOCATION_TYPES.RACK,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'RACK-A',
      path: 'ZONE-X/RACK-A',
    });

    const shelf = await Location.create({
      warehouse: warehouseA._id,
      parent: rack._id,
      type: LOCATION_TYPES.SHELF,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'SHELF-1',
      path: 'ZONE-X/RACK-A/SHELF-1',
    });

    const bin = await Location.create({
      warehouse: warehouseA._id,
      parent: shelf._id,
      type: LOCATION_TYPES.BIN,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'BIN-100',
      path: 'ZONE-X/RACK-A/SHELF-1/BIN-100',
    });

    const renameRes = await request(app)
      .patch(`/api/v1/locations/${rack._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'RACK-RENAMED' });

    expect(renameRes.status).toBe(200);
    expect(renameRes.body.data.path).toBe('ZONE-X/RACK-RENAMED');

    const updatedShelf = await Location.findById(shelf._id);
    const updatedBin = await Location.findById(bin._id);

    expect(updatedShelf.path).toBe('ZONE-X/RACK-RENAMED/SHELF-1');
    expect(updatedBin.path).toBe('ZONE-X/RACK-RENAMED/SHELF-1/BIN-100');
  });

  it('prevents deactivating a location with active children', async () => {
    const zone = await Location.create({
      warehouse: warehouseA._id,
      parent: null,
      type: LOCATION_TYPES.ZONE,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'ZONE-PARENT',
      path: 'ZONE-PARENT',
      isActive: true,
    });

    await Location.create({
      warehouse: warehouseA._id,
      parent: zone._id,
      type: LOCATION_TYPES.RACK,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'RACK-CHILD',
      path: 'ZONE-PARENT/RACK-CHILD',
      isActive: true,
    });

    const deactRes = await request(app)
      .delete(`/api/v1/locations/${zone._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deactRes.status).toBe(409);
    expect(deactRes.body.error.message).toMatch(/active child locations/i);
  });
});

describe('Bulk Location Generator & Tree View', () => {
  it('bulk creates a rack with shelves and bins in a single transaction', async () => {
    const zone = await Location.create({
      warehouse: warehouseA._id,
      parent: null,
      type: LOCATION_TYPES.ZONE,
      purpose: LOCATION_PURPOSES.STORAGE,
      code: 'ZONE-STORAGE',
      path: 'ZONE-STORAGE',
    });

    const bulkRes = await request(app)
      .post('/api/v1/locations/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        zone: zone._id.toString(),
        rackCode: 'RACK-BULK-01',
        purpose: LOCATION_PURPOSES.STORAGE,
        shelvesCount: 3,
        binsPerShelf: 4,
      });

    expect(bulkRes.status).toBe(201);
    expect(bulkRes.body.data.shelvesCreated).toBe(3);
    expect(bulkRes.body.data.binsCreated).toBe(12);
    expect(bulkRes.body.data.totalCreated).toBe(16);

    const allInWh = await Location.find({ warehouse: warehouseA._id });
    const bins = allInWh.filter((l) => l.type === LOCATION_TYPES.BIN);
    expect(bins).toHaveLength(12);
    expect(bins[0].path).toMatch(/^ZONE-STORAGE\/RACK-BULK-01\/S\d{2}\/B\d{2}$/);
  });

  it('builds a hierarchical tree structure for a warehouse', async () => {
    const treeRes = await request(app)
      .get(`/api/v1/locations/tree?warehouse=${warehouseA._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(treeRes.status).toBe(200);
    expect(Array.isArray(treeRes.body.data)).toBe(true);
    expect(treeRes.body.data.length).toBeGreaterThanOrEqual(5);

    const receivingNode = treeRes.body.data.find((n) => n.purpose === LOCATION_PURPOSES.RECEIVING);
    expect(receivingNode).toBeDefined();
    expect(Array.isArray(receivingNode.children)).toBe(true);
  });

  it('enforces RBAC permissions for viewer role', async () => {
    const readRes = await request(app)
      .get(`/api/v1/locations?warehouse=${warehouseA._id}`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(readRes.status).toBe(200);

    const writeRes = await request(app)
      .post('/api/v1/locations')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        warehouse: warehouseA._id.toString(),
        type: LOCATION_TYPES.ZONE,
        code: 'ZONE-UNAUTHORIZED',
      });

    expect(writeRes.status).toBe(403);
  });
});
