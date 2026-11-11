/**
 * StockPilot WMS - User request validation schemas.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { z } from 'zod';
import { ROLES } from '../auth/permissions.js';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../utils/pagination.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const PASSWORD_PATTERN = /^(?=.*[a-zA-Z])(?=.*\d).+$/;

export const userIdParamsSchema = z.object({ id: objectId });

export const createUserBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(PASSWORD_PATTERN, 'Password must contain letters and digits'),
  role: z.enum(Object.values(ROLES)),
  warehouses: z.array(objectId).optional().default([]),
});

export const updateUserBodySchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(Object.values(ROLES)).optional(),
    warehouses: z.array(objectId).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  search: z.string().trim().max(100).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
