/**
 * StockPilot WMS - MongoDB connection management.
 *
 * Provides helpers to open and close the Mongoose connection and exposes
 * a readable connection state for the health endpoint.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = Object.freeze({
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
});

/**
 * Opens the MongoDB connection using the configured URI.
 *
 * @returns {Promise<typeof mongoose>} The connected Mongoose instance.
 * @throws {Error} When the initial connection fails.
 */
export const connectDatabase = async () => {
  mongoose.set('strictQuery', true);
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (error) =>
    logger.error('MongoDB error', { message: error.message }),
  );
  await mongoose.connect(env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });
  logger.info('MongoDB connected', { database: mongoose.connection.name });
  return mongoose;
};

/**
 * Closes the MongoDB connection gracefully.
 *
 * @returns {Promise<void>}
 */
export const disconnectDatabase = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};

/**
 * Returns the human readable state of the MongoDB connection.
 *
 * @returns {string} One of: disconnected, connected, connecting, disconnecting.
 */
export const getDatabaseState = () => READY_STATES[mongoose.connection.readyState] ?? 'unknown';
