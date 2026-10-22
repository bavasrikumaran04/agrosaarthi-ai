import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { AUDIT_OUTCOMES, ROLES } from '../../shared/constants.js';
import { baseOptions } from '../schema-helpers.js';

/**
 * Append-only audit trail of security-relevant and administrative actions.
 * `details` must never contain secrets, passwords, full phone numbers or
 * conversation text — callers pass small, redacted summaries.
 */
const auditLogSchema = new Schema(
  {
    actorType: { type: String, enum: ['USER', 'SYSTEM', 'PROVIDER'], required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorRole: { type: String, enum: [...ROLES] },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 60 },
    targetId: { type: String, maxlength: 80 },
    outcome: { type: String, enum: [...AUDIT_OUTCOMES], required: true },
    requestId: { type: String, maxlength: 80 },
    details: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
  },
  baseOptions('audit_logs', { timestamps: { createdAt: true, updatedAt: false } }),
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuditLog = InferSchemaType<typeof auditLogSchema>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel = model('AuditLog', auditLogSchema);
