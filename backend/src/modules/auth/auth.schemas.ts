import { z } from 'zod';
import { KNOWN_LANGUAGE_CODES } from '../../shared/constants.js';

const name = z.string().trim().min(1, 'is required').max(120);
const languageCode = z.enum(KNOWN_LANGUAGE_CODES);
const place = z.string().trim().min(1).max(120);
/** Upper bound only — the length/commonness policy is enforced in the service with the configured minimum. */
const password = z.string().min(1, 'is required').max(128);

export const registerFarmerSchema = z.strictObject({
  name,
  phone: z.string().trim().min(6).max(32),
  password,
  preferredLanguage: languageCode,
  district: place.optional(),
  state: place.optional(),
  consent: z.strictObject({
    acceptPrivacyNotice: z.literal(true, { error: 'You must accept the privacy notice to register' }),
    aiProcessing: z.literal(true, { error: 'Consent to AI processing is required to use the AI features' }),
    privacyNoticeVersion: z.string().min(1).max(40),
  }),
});
export type RegisterFarmerInput = z.output<typeof registerFarmerSchema>;

export const loginSchema = z.strictObject({
  /** Phone number (farmers) or email address (experts/administrators). */
  identifier: z.string().trim().min(3).max(254),
  password,
});

export const updateMeSchema = z
  .strictObject({
    name: name.optional(),
    preferredLanguage: languageCode.optional(),
    district: place.nullable().optional(),
    state: place.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateMeInput = z.output<typeof updateMeSchema>;

export const changePasswordSchema = z.strictObject({
  currentPassword: password,
  newPassword: password,
});
