/**
 * Shared domain vocabulary. Every module, model and API schema imports these
 * lists instead of re-declaring string literals, so statuses stay consistent.
 */

export const ROLES = ['FARMER', 'EXPERT', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * ISO 639-1 codes the platform knows how to *describe*. Whether a language is
 * actually usable (UI translations, STT, TTS, AI, telephony) is decided at
 * runtime by the LanguageCapability registry — never by this list alone.
 * Covers English plus the major scheduled Indian languages.
 */
export const KNOWN_LANGUAGE_CODES = [
  'en', 'ta', 'hi', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'as', 'ur',
] as const;
export type LanguageCode = (typeof KNOWN_LANGUAGE_CODES)[number];

export const CHANNELS = ['WEB', 'WEB_VOICE', 'PHONE'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CASE_STATUSES = [
  'NEW',
  'TRIAGED',
  'ASSIGNED',
  'IN_REVIEW',
  'WAITING_FOR_FARMER',
  'CALLBACK_PENDING',
  'RESOLVED',
  'CLOSED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const CASE_ORIGINS = ['IMAGE_ANALYSIS', 'ASSISTANT_ESCALATION', 'PHONE_CALL', 'CALLBACK_REQUEST', 'MANUAL'] as const;
export type CaseOrigin = (typeof CASE_ORIGINS)[number];

export const CALL_STATES = [
  'NEW_CALL',
  'LANGUAGE_SELECTION',
  'CONSENT',
  'COLLECTING_QUESTION',
  'PROCESSING_SPEECH',
  'ASKING_FOLLOW_UP',
  'GENERATING_RESPONSE',
  'PLAYING_RESPONSE',
  'ESCALATION_OFFERED',
  'CALLBACK_REQUESTED',
  'TRANSFERRING',
  'CALL_COMPLETED',
  'CALL_FAILED',
] as const;
export type CallState = (typeof CALL_STATES)[number];

export const CALL_OUTCOMES = ['ANSWERED', 'ESCALATED', 'CALLBACK_REQUESTED', 'TRANSFERRED', 'ABANDONED', 'FAILED'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALLBACK_STATUSES = ['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];

export const CALLBACK_ATTEMPT_OUTCOMES = ['CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER', 'FAILED'] as const;
export type CallbackAttemptOutcome = (typeof CALLBACK_ATTEMPT_OUTCOMES)[number];

export const CALLBACK_SOURCES = ['WEB', 'PHONE', 'ASSISTANT', 'EXPERT', 'ADMIN'] as const;
export type CallbackSource = (typeof CALLBACK_SOURCES)[number];

/**
 * Knowledge trust levels. Only EXPERT_REVIEWED content may back specific
 * pesticide quantities in generated guidance (see assistant safety policy).
 */
export const TRUST_STATUSES = ['DRAFT', 'UNREVIEWED_SOURCE_SUMMARY', 'EXPERT_REVIEWED', 'RETIRED'] as const;
export type TrustStatus = (typeof TRUST_STATUSES)[number];

export const KNOWLEDGE_TOPICS = [
  'crop-overview',
  'symptoms',
  'causes',
  'favourable-conditions',
  'differential-diagnosis',
  'prevention',
  'cultural-management',
  'biological-management',
  'chemical-management',
  'safety',
  'regulation',
  'resources',
] as const;
export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

/** Final interpretation of an image analysis, from most to least actionable. */
export const ANALYSIS_OUTCOMES = [
  'LIKELY_MATCH', // model confident AND quality/domain checks passed — still a possibility, not a diagnosis
  'UNCERTAIN', // several classes plausible or confidence below threshold
  'OUT_OF_DOMAIN', // image does not look like a supported leaf photo
  'POOR_QUALITY', // blurry / too dark / too small to analyse
  'UNSUPPORTED_CROP', // farmer-declared crop is not covered by the model
] as const;
export type AnalysisOutcome = (typeof ANALYSIS_OUTCOMES)[number];

export const ANALYSIS_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const MESSAGE_ROLES = ['FARMER', 'ASSISTANT', 'EXPERT', 'SYSTEM'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const FILE_PURPOSES = ['CROP_IMAGE', 'VOICE_INPUT', 'TTS_AUDIO', 'CALL_RECORDING'] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

export const PROVIDER_KINDS = ['AI', 'IMAGE_MODEL', 'STT', 'TTS', 'TELEPHONY', 'STORAGE', 'DATABASE'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const PROVIDER_HEALTH_STATUSES = ['UP', 'DEGRADED', 'DOWN', 'NOT_CONFIGURED', 'SIMULATED'] as const;
export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number];

export const AI_FLAG_CATEGORIES = [
  'WRONG_DIAGNOSIS',
  'UNSAFE_ADVICE',
  'UNSUPPORTED_PESTICIDE_ADVICE',
  'WRONG_LANGUAGE',
  'MISATTRIBUTED_SOURCE',
  'UNHELPFUL',
  'OTHER',
] as const;
export type AiFlagCategory = (typeof AI_FLAG_CATEGORIES)[number];

export const PRIVACY_REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'DELETION'] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];

export const AUDIT_OUTCOMES = ['SUCCESS', 'DENIED', 'FAILURE'] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];
