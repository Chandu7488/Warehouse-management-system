/**
 * StockPilot WMS - Environment configuration.
 *
 * Loads variables from the process environment (and .env in development),
 * validates them with Zod and exports a frozen, typed configuration object.
 * The process exits immediately when a required variable is missing or invalid.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import 'dotenv/config';
import { z } from 'zod';

const MONGODB_URI_PATTERN = /^mongodb(\+srv)?:\/\/.+/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGODB_URI: z
    .string()
    .regex(MONGODB_URI_PATTERN, 'MONGODB_URI must start with mongodb:// or mongodb+srv://')
    .default(
      'mongodb+srv://stockpilot_app:6AEQw8xOgQGlq5cd@stockpilot-cluster.y3hhofr.mongodb.net/stockpilot_wms?retryWrites=true&w=majority',
    ),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .default('9708b27a71e11cee384e51ad23e0f8de079697a3f47319f0f673d0626371242196705f1d449f98982e56f2827a187a3f'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .default('7fd17448d2aa2da83562e2894f69fad0a899586ed866817d9017a1e71dc907538f978903a44ae7ca02475c21f92c95d8'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
});

/**
 * Validates raw environment variables against the schema.
 *
 * @param {NodeJS.ProcessEnv} rawEnv - Raw environment variables.
 * @returns {z.infer<typeof envSchema>} Parsed and validated configuration.
 * @throws {Error} When one or more variables are invalid.
 */
export const parseEnv = (rawEnv) => {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
};

/**
 * Frozen application configuration.
 *
 * @type {Readonly<ReturnType<typeof parseEnv>>}
 */
export const env = Object.freeze(parseEnv(process.env));
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
