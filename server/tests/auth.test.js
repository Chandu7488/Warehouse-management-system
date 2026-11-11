/**
 * StockPilot WMS - Authentication and authorization integration tests.
 *
 * Verifies login, lockout, token rotation, reuse detection, RBAC authorization,
 * and user management security controls.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { RefreshToken } from '../src/modules/auth/refreshToken.model.js';
import { ROLES, PERMISSIONS } from '../src/modules/auth/permissions.js';
import { generateAccessToken } from '../src/modules/auth/token.service.js';

let mongod;
let defaultPasswordHash;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  defaultPasswordHash = await bcrypt.hash('Password123', 10);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('POST /api/v1/auth/login', () => {
  it('authenticates valid credentials and issues auth cookies', async () => {
    await User.create({
      name: 'Test Administrator',
      email: 'admin@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@stockpilot.local', password: 'Password123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('admin@stockpilot.local');
    expect(response.body.data.passwordHash).toBeUndefined();
    expect(response.body.data.permissions).toContain(PERMISSIONS.USERS_READ);

    const cookies = response.headers['set-cookie'] || [];
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects invalid password and increments failed login counter', async () => {
    await User.create({
      name: 'Staff Member',
      email: 'clerk@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.INVENTORY_CLERK,
      isActive: true,
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'clerk@stockpilot.local', password: 'WrongPassword1' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('UNAUTHORIZED');

    const updated = await User.findOne({ email: 'clerk@stockpilot.local' });
    expect(updated.failedLoginCount).toBe(1);
  });

  it('locks account after 5 consecutive failed attempts', async () => {
    await User.create({
      name: 'Locked Target',
      email: 'target@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.VIEWER,
      failedLoginCount: 4,
      isActive: true,
    });

    const fifthAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'target@stockpilot.local', password: 'WrongPassword1' });

    expect(fifthAttempt.status).toBe(401);

    const sixthAttempt = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'target@stockpilot.local', password: 'Password123' });

    expect(sixthAttempt.status).toBe(403);
    expect(sixthAttempt.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects deactivated user accounts', async () => {
    await User.create({
      name: 'Inactive User',
      email: 'inactive@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.PICKER_PACKER,
      isActive: false,
    });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'inactive@stockpilot.local', password: 'Password123' });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Account is deactivated');
  });
});

describe('Token rotation and reuse detection', () => {
  it('rotates refresh token and replaces old record', async () => {
    await User.create({
      name: 'Refresh User',
      email: 'refresh@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.SALES,
      isActive: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'refresh@stockpilot.local', password: 'Password123' });

    const rawCookies = loginRes.headers['set-cookie'] || [];
    const refreshCookie = rawCookies.find((c) => c.startsWith('refresh_token=')).split(';')[0];

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);

    const oldToken = await RefreshToken.findOne({ replacedBy: { $ne: null } });
    expect(oldToken).not.toBeNull();
    expect(oldToken.revokedAt).not.toBeNull();
  });

  it('detects refresh token reuse and revokes entire token family', async () => {
    await User.create({
      name: 'Reuse User',
      email: 'reuse@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.SALES,
      isActive: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reuse@stockpilot.local', password: 'Password123' });

    const rawCookies = loginRes.headers['set-cookie'] || [];
    const refreshCookie = rawCookies.find((c) => c.startsWith('refresh_token=')).split(';')[0];

    await request(app).post('/api/v1/auth/refresh').set('Cookie', [refreshCookie]);

    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshCookie]);

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.message).toContain('reuse detected');

    const activeTokens = await RefreshToken.find({ revokedAt: null });
    expect(activeTokens.length).toBe(0);
  });
});

describe('RBAC and route protection', () => {
  it('allows ADMIN to access user management and create a PICKER_PACKER', async () => {
    const admin = await User.create({
      name: 'System Admin',
      email: 'sysadmin@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    const adminToken = generateAccessToken({ id: admin._id.toString(), role: ROLES.ADMIN });

    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Warehouse Picker',
        email: 'picker@stockpilot.local',
        password: 'PickerPassword1',
        role: ROLES.PICKER_PACKER,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.role).toBe(ROLES.PICKER_PACKER);
    expect(createRes.body.data.passwordHash).toBeUndefined();
  });

  it('forbids PICKER_PACKER from creating categories or accessing user management', async () => {
    const picker = await User.create({
      name: 'Order Picker',
      email: 'picker2@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.PICKER_PACKER,
      isActive: true,
    });

    const pickerToken = generateAccessToken({
      id: picker._id.toString(),
      role: ROLES.PICKER_PACKER,
    });

    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${pickerToken}`);
    expect(usersRes.status).toBe(403);

    const categoryRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${pickerToken}`)
      .send({ name: 'Disallowed Category' });
    expect(categoryRes.status).toBe(403);
  });

  it('prevents an administrator from deactivating themselves', async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin2@stockpilot.local',
      passwordHash: defaultPasswordHash,
      role: ROLES.ADMIN,
      isActive: true,
    });

    const adminToken = generateAccessToken({ id: admin._id.toString(), role: ROLES.ADMIN });

    const selfDeactivateRes = await request(app)
      .patch(`/api/v1/users/${admin._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(selfDeactivateRes.status).toBe(400);
    expect(selfDeactivateRes.body.error.message).toContain('cannot deactivate');
  });
});
