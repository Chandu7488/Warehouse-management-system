/**
 * StockPilot WMS - Express application.
 *
 * Builds the HTTP application without starting a server so that it can be
 * imported by automated tests.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env, isTest } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

import healthRoutes from './modules/health/health.routes.js';
import { connectDatabase } from './config/database.js';

const app = express();

// Trust reverse proxy (Vercel, AWS Lambda, Nginx) so client IP and protocol headers are correctly handled
app.set('trust proxy', 1);

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' },
  },
});

app.use(helmet());

// Flexible CORS for local dev and Vercel preview/production deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin serverless proxies)
      if (!origin || origin === env.CLIENT_URL || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

if (!isTest) {
  app.use(morgan('combined'));
}

// 1. Instant diagnostics: Mount health endpoints before DB middleware and rate limiters
app.use('/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/v1/health', healthRoutes);

// 2. Serverless database connection middleware (ensures warm Lambda connections without hanging)
if (process.env.VERCEL) {
  app.use(async (_req, _res, next) => {
    try {
      await connectDatabase();
      next();
    } catch (err) {
      next(err);
    }
  });
}

// 3. API rate limiting & versioned routes (supports both /api/v1 and /v1)
app.use('/api', apiRateLimiter);
app.use('/api/v1', apiRouter);
app.use('/v1', apiRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
