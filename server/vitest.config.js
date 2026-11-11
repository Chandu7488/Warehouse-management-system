/**
 * StockPilot WMS - Vitest configuration for the API server.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      PORT: '5001',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/stockpilot_wms_test',
      CLIENT_URL: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test_access_secret_that_is_at_least_32_chars',
      JWT_REFRESH_SECRET: 'test_refresh_secret_that_is_at_least_32_chars',
      COOKIE_SECURE: 'false',
      LOG_LEVEL: 'silent',
    },
  },
});
