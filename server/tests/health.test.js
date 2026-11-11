/**
 * StockPilot WMS - Health and error handling integration tests.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/v1/health', () => {
  it('returns the standard success envelope', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data).toHaveProperty('database');
  });
});

describe('unknown routes', () => {
  it('returns the standard error envelope with status 404', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('request validation', () => {
  it('rejects an invalid category identifier with status 422', async () => {
    const response = await request(app).get('/api/v1/categories/not-an-id');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details[0].source).toBe('params');
  });

  it('rejects a category body without a name', async () => {
    const response = await request(app).post('/api/v1/categories').send({});
    expect(response.status).toBe(422);
    expect(response.body.error.details[0].field).toBe('name');
  });

  it('rejects malformed JSON with status 400', async () => {
    const response = await request(app)
      .post('/api/v1/categories')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(response.status).toBe(400);
  });
});
