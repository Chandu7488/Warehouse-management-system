/**
 * StockPilot WMS - Administrator seed script.
 *
 * Creates the initial system administrator user from environment variables
 * or defaults. Refuses to run if any administrator account already exists.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { User } from '../modules/users/user.model.js';
import { ROLES } from '../modules/auth/permissions.js';
import { logger } from '../utils/logger.js';

const BCRYPT_SALT_ROUNDS = 12;

/**
 * Executes the administrator seeding operation.
 *
 * @returns {Promise<void>}
 */
const seedAdmin = async () => {
  await connectDatabase();

  const existingAdmin = await User.findOne({ role: ROLES.ADMIN });
  if (existingAdmin) {
    logger.info('Administrator account already exists. Seeding skipped.');
    await disconnectDatabase();
    process.exit(0);
  }

  const name = process.env.ADMIN_NAME || 'StockPilot Administrator';
  const email = (process.env.ADMIN_EMAIL || 'admin@stockpilot.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin@123456';

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const admin = await User.create({
    name,
    email,
    passwordHash,
    role: ROLES.ADMIN,
    isActive: true,
  });

  logger.info('Default administrator account created successfully', {
    id: admin._id.toString(),
    email: admin.email,
  });

  await disconnectDatabase();
  process.exit(0);
};

seedAdmin().catch(async (error) => {
  logger.error('Failed to seed administrator account', { message: error.message });
  await disconnectDatabase();
  process.exit(1);
});
