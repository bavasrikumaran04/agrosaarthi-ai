/**
 * Create the first administrator (staff accounts are never self-registered).
 *   npm run admin:create -- --email admin@example.org --name "Admin Name"
 *   npm run admin:create -- --email admin@example.org --reset-password   (account recovery)
 * Password: taken from ADMIN_PASSWORD if set, otherwise a strong random one is
 * printed ONCE. It must be changed at first sign-in. Never put passwords in files.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { RefreshTokenModel } from '../db/models/refresh-token.model.js';
import { UserModel } from '../db/models/user.model.js';
import { createSilentLogger } from '../lib/logger.js';
import { createPasswordHasher, passwordPolicyIssues } from '../modules/auth/password.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' }, 'reset-password': { type: 'boolean' } } });
const reset = values['reset-password'] === true;
if (!values.email || (!values.name && !reset)) {
  console.error('Usage: npm run admin:create -- --email <email> --name "<full name>"');
  process.exit(1);
}

const config = loadConfig();
const password = process.env.ADMIN_PASSWORD ?? randomBytes(15).toString('base64url');
const issues = passwordPolicyIssues(password, config.auth.passwordMinLength);
if (issues.length) {
  console.error(`ADMIN_PASSWORD ${issues.join('; ')}`);
  process.exit(1);
}

await connectDatabase(config.database, createSilentLogger());
try {
  const email = values.email.trim().toLowerCase();
  const hasher = createPasswordHasher({ memoryCostKiB: config.auth.passwordHashMemoryKiB, timeCost: config.auth.passwordHashTimeCost });
  if (reset) {
    // Recovery: new one-time password, forced change, all sessions invalidated.
    const res = await UserModel.updateOne(
      { email, role: 'ADMIN' },
      { $set: { passwordHash: await hasher.hash(password), mustChangePassword: true, failedLoginCount: 0 }, $unset: { lockedUntil: 1 }, $inc: { tokenVersion: 1 } },
    );
    if (res.matchedCount === 0) {
      console.error(`No administrator with email ${email}.`);
      process.exitCode = 1;
    } else {
      const admin = await UserModel.findOne({ email }, { _id: 1 }).lean();
      await RefreshTokenModel.updateMany({ userId: admin!._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedReason: 'admin-reset' } });
      console.log(`Password reset for ${email}; all sessions signed out.`);
      if (!process.env.ADMIN_PASSWORD) console.log(`One-time password (shown once, change at first sign-in): ${password}`);
    }
  } else if (await UserModel.exists({ email })) {
    console.error(`A user with email ${email} already exists.`);
    process.exitCode = 1;
  } else {
    await UserModel.create({ name: values.name!.trim(), email, role: 'ADMIN', passwordHash: await hasher.hash(password), mustChangePassword: true, preferredLanguage: 'en' });
    console.log(`Administrator ${email} created.`);
    if (!process.env.ADMIN_PASSWORD) console.log(`One-time password (shown once, change at first sign-in): ${password}`);
  }
} finally {
  await disconnectDatabase();
}
