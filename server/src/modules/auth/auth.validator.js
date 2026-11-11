/**
 * StockPilot WMS - Authentication request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';

const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).+$/;

export const loginBodySchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(PASSWORD_PATTERN, 'Password must contain letters and digits'),
});
