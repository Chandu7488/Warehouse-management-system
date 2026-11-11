/**
 * StockPilot WMS - Health check routes.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import { getHealth } from './health.controller.js';

const router = Router();

router.get('/', getHealth);

export default router;
