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

const app = express();

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
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

if (!isTest) {
  app.use(morgan('combined'));
}

app.use('/api', apiRateLimiter);
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
