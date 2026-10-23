/**
 * Local demonstration accounts (refused when NODE_ENV=production).
 *   DEMO_PASSWORD='choose-a-password' npm run demo:setup
 * Creates — or resets the password of — one demo farmer (signs in with a phone number)
 * and one demo expert (signs in with an email). No passwords are stored in files:
 * DEMO_PASSWORD is used if set, otherwise a random one is printed once.
 * Accounts are real records; everything they do in the demo goes through the normal API.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadConfig } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { RefreshTokenModel } from '../db/models/refresh-token.model.js';
import { UserModel } from '../db/models/user.model.js';
import { createSilentLogger } from '../lib/logger.js';
import { createPersonalDataProtector } from '../lib/personal-data.js';
import { createPasswordHasher, passwordPolicyIssues } from '../modules/auth/password.js';
import { PRIVACY_NOTICE_VERSION } from '../shared/language-registry.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const config = loadConfig();
if (config.core.nodeEnv === 'production') {
  console.error('demo:setup is for local demonstrations only and is refused in production.');
  process.exit(1);
}

const FARMER_PHONE = process.env.DEMO_FARMER_PHONE ?? '9000000001';
const EXPERT_EMAIL = (process.env.DEMO_EXPERT_EMAIL ?? 'expert@agrosaarthi.local').toLowerCase();
const password = process.env.DEMO_PASSWORD ?? randomBytes(9).toString('base64url');
const issues = passwordPolicyIssues(password, config.auth.passwordMinLength);
if (issues.length) {
  console.error(`DEMO_PASSWORD ${issues.join('; ')}`);
  process.exit(1);
}

await connectDatabase(config.database, createSilentLogger());
try {
  const hasher = createPasswordHasher({ memoryCostKiB: config.auth.passwordHashMemoryKiB, timeCost: config.auth.passwordHashTimeCost });
  const protector = createPersonalDataProtector(config.security.dataEncryptionKey, config.security.dataHashKey);
  const passwordHash = await hasher.hash(password);
  const reset = { passwordHash, mustChangePassword: false, failedLoginCount: 0, status: 'ACTIVE' };

  const phone = protector.protectPhone(FARMER_PHONE);
  if (!phone) throw new Error(`DEMO_FARMER_PHONE is not a valid Indian mobile number: ${FARMER_PHONE}`);
  const farmer = await UserModel.findOne({ 'phone.hash': phone.hash });
  if (farmer) {
    await UserModel.updateOne({ _id: farmer._id }, { $set: reset, $unset: { lockedUntil: 1 }, $inc: { tokenVersion: 1 } });
    await RefreshTokenModel.updateMany({ userId: farmer._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedReason: 'demo-reset' } });
  } else {
    await UserModel.create({
      name: 'Murugan (demo farmer)', phone, role: 'FARMER', passwordHash, preferredLanguage: 'ta',
      district: 'Thanjavur', state: 'Tamil Nadu',
      consent: { aiProcessing: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, givenAt: new Date() },
    });
  }

  const expert = await UserModel.findOne({ email: EXPERT_EMAIL });
  if (expert) {
    if (expert.role !== 'EXPERT') throw new Error(`${EXPERT_EMAIL} exists with role ${expert.role}; choose another DEMO_EXPERT_EMAIL.`);
    await UserModel.updateOne({ _id: expert._id }, { $set: reset, $unset: { lockedUntil: 1 }, $inc: { tokenVersion: 1 } });
    await RefreshTokenModel.updateMany({ userId: expert._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revokedReason: 'demo-reset' } });
  } else {
    await UserModel.create({ name: 'Dr. Kavitha (demo expert)', email: EXPERT_EMAIL, role: 'EXPERT', passwordHash, mustChangePassword: false, preferredLanguage: 'en' });
  }

  console.log('Demo accounts ready (local only):');
  console.log(`  Farmer : mobile ${FARMER_PHONE}`);
  console.log(`  Expert : ${EXPERT_EMAIL}`);
  console.log(process.env.DEMO_PASSWORD ? '  Password: the DEMO_PASSWORD you set' : `  Password (shown once): ${password}`);
} finally {
  await disconnectDatabase();
}
