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

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Opens or retrieves the cached MongoDB connection using the configured URI.
 * Implements global singleton connection caching for serverless warm invocations.
 *
 * @returns {Promise<typeof mongoose>} The connected Mongoose instance.
 * @throws {Error} When the connection fails.
 */
export const connectDatabase = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
    mongoose.connection.on('error', (error) =>
      logger.error('MongoDB error', { message: error.message }),
    );

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3500,
    };

    cached.promise = mongoose.connect(env.MONGODB_URI, opts).then((m) => {
      logger.info('MongoDB connected', { database: mongoose.connection.name });
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
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
