import { z } from 'zod';
import { defineSection, envPositiveInt } from '../helpers.js';

/**
 * Data-retention periods (see docs/DATA_RETENTION.md). Enforced by MongoDB TTL
 * indexes where a record carries an `expiresAt` date, and by the retention job
 * for files in object storage.
 */
export const retentionSection = defineSection({
  name: 'retention',
  schema: z.object({
    RETENTION_CONVERSATION_DAYS: envPositiveInt.max(3650).default(90),
    RETENTION_CROP_IMAGE_DAYS: envPositiveInt.max(3650).default(365),
    RETENTION_VOICE_INPUT_HOURS: envPositiveInt.max(24 * 30).default(24),
    RETENTION_TTS_AUDIO_HOURS: envPositiveInt.max(24 * 30).default(24),
    RETENTION_CALL_RECORDING_DAYS: envPositiveInt.max(365).default(7),
    RETENTION_CALL_SESSION_DAYS: envPositiveInt.max(3650).default(180),
    RETENTION_AUDIT_LOG_DAYS: envPositiveInt.max(3650).default(365),
    RETENTION_WEBHOOK_EVENT_HOURS: envPositiveInt.max(24 * 30).default(48),
    RETENTION_PROVIDER_HEALTH_DAYS: envPositiveInt.max(365).default(30),
  }),
  map: (e) => ({
    conversationDays: e.RETENTION_CONVERSATION_DAYS,
    cropImageDays: e.RETENTION_CROP_IMAGE_DAYS,
    voiceInputHours: e.RETENTION_VOICE_INPUT_HOURS,
    ttsAudioHours: e.RETENTION_TTS_AUDIO_HOURS,
    callRecordingDays: e.RETENTION_CALL_RECORDING_DAYS,
    callSessionDays: e.RETENTION_CALL_SESSION_DAYS,
    auditLogDays: e.RETENTION_AUDIT_LOG_DAYS,
    webhookEventHours: e.RETENTION_WEBHOOK_EVENT_HOURS,
    providerHealthDays: e.RETENTION_PROVIDER_HEALTH_DAYS,
  }),
});

export type RetentionConfig = ReturnType<typeof retentionSection.map>;
