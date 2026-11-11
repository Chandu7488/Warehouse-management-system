/**
 * StockPilot WMS - Process entry point.
 *
 * Connects to MongoDB, starts the HTTP server and handles graceful shutdown.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

/**
 * Starts the application.
 *
 * @returns {Promise<void>}
 */
const start = async () => {
  await connectDatabase();
  const server = app.listen(env.PORT, () => {
    logger.info('StockPilot API listening', { port: env.PORT, environment: env.NODE_ENV });
  });

  /**
   * Stops accepting connections, closes MongoDB and exits.
   *
   * @param {string} signal - Received signal name.
   * @returns {void}
   */
  const shutdown = (signal) => {
    logger.info('Shutdown signal received', { signal });
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

start().catch((error) => {
  logger.error('Failed to start server', { message: error.message });
  process.exit(1);
});
