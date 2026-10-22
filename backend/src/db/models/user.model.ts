import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ROLES, USER_STATUSES } from '../../shared/constants.js';
import { baseOptions, protectedPhoneSchema } from '../schema-helpers.js';

/**
 * Login accounts. Farmers sign in with their phone number; experts and
 * administrators sign in with email. Staff accounts are created by an
 * administrator — there is no public registration for privileged roles.
 */
const expertProfileSchema = new Schema(
  {
    specializations: { type: [String], default: [] }, // crop keys
    languages: { type: [String], default: [] }, // language codes the expert can serve
    region: { type: String, maxlength: 120 },
    maxActiveCases: { type: Number, min: 1, max: 500, default: 25 },
  },
  { _id: false },
);

const consentSchema = new Schema(
  {
    aiProcessing: { type: Boolean, required: true },
    privacyNoticeVersion: { type: String, required: true, maxlength: 40 },
    givenAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: protectedPhoneSchema, required: false },
    role: { type: String, enum: [...ROLES], required: true },
    extraPermissions: { type: [String], default: [] },
    status: { type: String, enum: [...USER_STATUSES], default: 'ACTIVE' },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: false },
    preferredLanguage: { type: String, default: 'ta', maxlength: 8 },
    district: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    expertProfile: { type: expertProfileSchema, required: false },
    consent: { type: consentSchema, required: false },
    /** Incremented on password change / forced sign-out; access tokens carry it. */
    tokenVersion: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    /** Demo/seed account — never a real person. */
    isDemo: { type: Boolean, default: false },
    /** Set when personal data was erased on request; the record is kept for referential integrity. */
    anonymizedAt: { type: Date },
  },
  baseOptions('users'),
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ 'phone.hash': 1 }, { unique: true, partialFilterExpression: { 'phone.hash': { $type: 'string' } } });
userSchema.index({ role: 1, status: 1, createdAt: -1 });

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
