/**
 * StockPilot WMS - Authentication routes.
 *
 * Exposes login, refresh, logout, profile, and password update endpoints.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { Router } from 'express';
import * as controller from './auth.controller.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { authRateLimiter } from '../../middlewares/rateLimiters.js';
import { loginBodySchema, changePasswordBodySchema } from './auth.validator.js';

const router = Router();

router.post('/login', authRateLimiter, validate({ body: loginBodySchema }), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.getMe);
router.patch(
  '/me/password',
  authenticate,
  validate({ body: changePasswordBodySchema }),
  controller.changePassword,
);

export default router;
