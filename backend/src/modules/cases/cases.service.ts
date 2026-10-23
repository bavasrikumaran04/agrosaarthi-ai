import { Types } from 'mongoose';
import { CallbackRequestModel } from '../../db/models/callback-request.model.js';
import { CaseMessageModel } from '../../db/models/case-message.model.js';
import { nextSequence } from '../../db/models/counter.model.js';
import { ExpertAssessmentModel } from '../../db/models/expert-assessment.model.js';
import { ExpertAssignmentModel } from '../../db/models/expert-assignment.model.js';
import { ImageAnalysisModel } from '../../db/models/image-analysis.model.js';
import { SupportCaseModel, type SupportCase } from '../../db/models/support-case.model.js';
import { UserModel } from '../../db/models/user.model.js';
import type { Clock } from '../../lib/clock.js';
import { Errors } from '../../lib/errors.js';
import { buildPaginationMeta, escapeRegex, toSkipLimit, type PaginationQuery } from '../../lib/pagination.js';
import type { PaginationMeta } from '../../lib/http.js';
import { maskPhone } from '../../lib/phone.js';
import type { AuthContext } from '../../middleware/auth.js';
import { CASE_PRIORITIES, type CasePriority, type CaseStatus } from '../../shared/constants.js';
import type { ActorRef, CasePort, CaseRef, CreateCaseInput, SourceRef } from '../../shared/ports.js';
import type { AuditService } from '../audit/audit.service.js';
import { actorKinds, ASSIGNABLE_STATUSES, checkTransition, OPEN_STATUSES } from './case-state-machine.js';

type CaseLean = SupportCase & { _id: Types.ObjectId; createdAt?: Date; updatedAt?: Date };

export type CaseScope = 'mine' | 'assigned' | 'unassigned' | 'resolved' | 'all';

export interface ListCasesQuery extends PaginationQuery {
  scope?: CaseScope;
  status?: CaseStatus;
  priority?: CasePriority;
  cropKey?: string;
  q?: string;
}

const priorityRank = (p: string) => CASE_PRIORITIES.indexOf(p as CasePriority);

function isStaff(a: AuthContext) {
  return a.role === 'EXPERT' || a.role === 'ADMIN';
}

/** Who may see what. Returns 'FULL', 'TRIAGE' (identity hidden) or null. */
export function caseAccess(a: AuthContext, c: Pick<CaseLean, 'farmerUserId' | 'assignedExpertId' | 'status'>): 'FULL' | 'TRIAGE' | null {
  if (a.role === 'ADMIN') return 'FULL';
  if (a.role === 'FARMER') return c.farmerUserId?.toHexString() === a.userId ? 'FULL' : null;
  if (a.role === 'EXPERT') {
    if (c.assignedExpertId?.toHexString() === a.userId) return 'FULL';
    if (a.permissions.has('case:read:all')) return 'FULL';
    if (!c.assignedExpertId && (c.status === 'NEW' || c.status === 'TRIAGED') && a.permissions.has('case:triage')) return 'TRIAGE';
  }
  return null;
}

export interface CasesService extends CasePort {
  list(a: AuthContext, q: ListCasesQuery): Promise<{ items: CaseSummaryDto[]; pagination: PaginationMeta }>;
  detail(a: AuthContext, id: string): Promise<CaseDetailDto>;
  createManual(a: AuthContext, input: { language: string; cropKey?: string; cropFreeText?: string; symptomsText: string; district?: string }): Promise<CaseRef>;
  requestExpertReview(a: AuthContext, id: string, reason?: string): Promise<CaseRef>;
  addMessage(a: AuthContext, id: string, text: string, internal: boolean): Promise<void>;
  assign(a: AuthContext, id: string, expertId: string): Promise<CaseRef>;
  setStatus(a: AuthContext, id: string, to: CaseStatus, note?: string): Promise<CaseRef>;
  setPriority(a: AuthContext, id: string, priority: CasePriority): Promise<void>;
  addAssessment(
    a: AuthContext,
    id: string,
    input: { diagnosis: string; certainty: 'CONFIRMED' | 'PROBABLE' | 'UNCERTAIN'; recommendations: string; aiAgreement: 'AGREES' | 'PARTIALLY_AGREES' | 'DISAGREES' | 'NOT_APPLICABLE'; visibleToFarmer: boolean },
  ): Promise<void>;
  requestCallback(a: AuthContext, id: string, input: { preferredTimeWindow: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'; reason?: string }): Promise<{ id: string; created: boolean }>;
  recordCallbackAttempt(a: AuthContext, callbackId: string, outcome: 'CONNECTED' | 'NO_ANSWER' | 'BUSY' | 'WRONG_NUMBER' | 'FAILED', notes?: string): Promise<void>;
  revealContact(a: AuthContext, id: string): Promise<{ phone: string }>;
  expertDashboard(a: AuthContext): Promise<Record<string, number>>;
  listExperts(): Promise<Array<{ id: string; name: string; languages: string[]; openCases: number; maxActiveCases: number }>>;
}

export interface CaseSummaryDto {
  id: string;
  caseNumber: string;
  status: string;
  priority: string;
  origin: string;
  channel: string;
  language: string;
  cropKey?: string;
  symptomsPreview?: string;
  escalated: boolean;
  assignedExpert?: { id: string; name: string };
  latestAnalysis?: { outcome?: string; topLabel?: string; topScore?: number; simulated?: boolean };
  lastActivityAt?: string;
  createdAt?: string;
}

export interface CaseDetailDto extends CaseSummaryDto {
  view: 'FULL' | 'TRIAGE';
  symptomsText?: string;
  district?: string;
  farmer?: { name?: string; phoneMasked?: string };
  escalation: { required: boolean; reasons: string[] };
  aiSummary?: { text: string; language?: string; provider?: string; simulated?: boolean; label: string };
  sources: SourceRef[];
  analyses: Array<{
    id: string;
    status: string;
    outcome?: string;
    model: { name?: string; version?: string; simulated?: boolean };
    predictions: Array<{ label?: string; diseaseKey?: string; score: number }>;
    qualityIssues: string[];
    outOfDomain?: boolean;
    guidance?: { text?: string; sources: SourceRef[]; escalationRecommended?: boolean };
    imageFileId: string;
    createdAt?: string;
  }>;
  messages: Array<{ id: string; authorRole: string; authorName?: string; text: string; internal: boolean; createdAt?: string }>;
  assessments: Array<{ id: string; expertName?: string; diagnosis: string; certainty: string; recommendations: string; aiAgreement: string; visibleToFarmer: boolean; createdAt?: string }>;
  callbacks: Array<{ id: string; status: string; preferredTimeWindow: string; attempts: number; createdAt?: string }>;
  statusHistory: Array<{ from?: string; to: string; byRole?: string; at: string; note?: string }>;
  allowedTransitions: string[];
}

export function createCasesService(deps: { clock: Clock; audit: AuditService; decryptPhone: (encrypted: string) => string }): CasesService {
  const { clock, audit } = deps;

  const load = async (id: string): Promise<CaseLean> => {
    if (!Types.ObjectId.isValid(id)) throw Errors.notFound('Case');
    const c = (await SupportCaseModel.findById(id).lean()) as CaseLean | null;
    if (!c) throw Errors.notFound('Case');
    return c;
  };

  const loadAccessible = async (a: AuthContext, id: string, need: 'FULL' | 'ANY' = 'ANY') => {
    const c = await load(id);
    const access = caseAccess(a, c);
    if (!access || (need === 'FULL' && access !== 'FULL')) {
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'authz.denied', targetType: 'SupportCase', targetId: id, outcome: 'DENIED' });
      throw Errors.notFound('Case');
    }
    return { c, access };
  };

  const ref = (c: { _id: Types.ObjectId; caseNumber: string; status: string }): CaseRef => ({
    id: c._id.toHexString(),
    caseNumber: c.caseNumber,
    status: c.status as CaseStatus,
  });

  const kindsFor = (a: AuthContext, c: CaseLean) =>
    actorKinds({
      role: a.role,
      isOwner: c.farmerUserId?.toHexString() === a.userId,
      isAssignedExpert: c.assignedExpertId?.toHexString() === a.userId,
      canTriage: a.permissions.has('case:triage'),
      caseUnassigned: !c.assignedExpertId,
    });

  /** Atomic conditional status change; fails if another request changed the status first. */
  const transition = async (c: CaseLean, to: CaseStatus, byRole: string, byUserId: string | undefined, note?: string) => {
    const now = clock.now();
    const updated = await SupportCaseModel.findOneAndUpdate(
      { _id: c._id, status: c.status },
      {
        $set: { status: to, lastActivityAt: now, ...(to === 'RESOLVED' ? { resolution: { summary: note, resolvedBy: byUserId, resolvedAt: now } } : {}) },
        $push: { statusHistory: { from: c.status, to, byUserId, byRole, at: now, note } },
      },
      { new: true },
    ).lean();
    if (!updated) throw Errors.conflict('The case was updated by someone else; reload and try again');
    return updated;
  };

  const summary = (c: CaseLean, experts: Map<string, string>): CaseSummaryDto => ({
    id: c._id.toHexString(),
    caseNumber: c.caseNumber,
    status: c.status,
    priority: c.priority,
    origin: c.origin,
    channel: c.channel,
    language: c.language,
    cropKey: c.cropKey ?? undefined,
    symptomsPreview: c.symptomsText ? c.symptomsText.slice(0, 140) : undefined,
    escalated: Boolean(c.escalation?.required),
    assignedExpert: c.assignedExpertId
      ? { id: c.assignedExpertId.toHexString(), name: experts.get(c.assignedExpertId.toHexString()) ?? '' }
      : undefined,
    latestAnalysis: c.latestAnalysis
      ? { outcome: c.latestAnalysis.outcome ?? undefined, topLabel: c.latestAnalysis.topLabel ?? undefined, topScore: c.latestAnalysis.topScore ?? undefined, simulated: c.latestAnalysis.simulated ?? undefined }
      : undefined,
    lastActivityAt: c.lastActivityAt?.toISOString(),
    createdAt: c.createdAt?.toISOString(),
  });

  const namesOf = async (ids: Array<Types.ObjectId | null | undefined>) => {
    const unique = [...new Set(ids.filter(Boolean).map((i) => i!.toHexString()))];
    if (unique.length === 0) return new Map<string, string>();
    const users = await UserModel.find({ _id: { $in: unique } }, { name: 1 }).lean();
    return new Map(users.map((u) => [u._id.toHexString(), u.name]));
  };

  const service: CasesService = {
    // ----- CasePort -----
    async createCase(input: CreateCaseInput, actor: ActorRef) {
      const now = clock.now();
      const seq = await nextSequence(`case-${now.getUTCFullYear()}`);
      const caseNumber = `AGS-${now.getUTCFullYear()}-${String(seq).padStart(6, '0')}`;
      const doc = await SupportCaseModel.create({
        caseNumber,
        origin: input.origin,
        channel: input.channel,
        farmerUserId: input.farmerUserId,
        farmerProfileId: input.farmerProfileId,
        language: input.language,
        cropKey: input.cropKey,
        cropFreeText: input.cropFreeText,
        symptomsText: input.symptomsText,
        district: input.district,
        state: input.state,
        priority: input.priority ?? 'NORMAL',
        conversationId: input.conversationId,
        callSessionId: input.callSessionId,
        escalation: input.escalation
          ? { required: true, reasons: input.escalation.reasons, requestedBy: input.escalation.requestedBy, requestedAt: now }
          : { required: false, reasons: [] },
        sources: input.sources ?? [],
        statusHistory: [{ to: 'NEW', byRole: actor.type === 'USER' ? actor.role : 'SYSTEM', byUserId: actor.type === 'USER' ? actor.userId : undefined, at: now }],
        lastActivityAt: now,
        isDemo: input.isDemo ?? false,
      });
      return ref(doc);
    },

    async attachImageAnalysis(caseId, s, sources) {
      const c = await load(caseId);
      const existing = new Set((c.sources ?? []).map((x) => String(x.chunkId ?? x.docKey)));
      const fresh = sources.filter((x) => !existing.has(String(x.chunkId ?? x.docKey)));
      await SupportCaseModel.updateOne(
        { _id: c._id },
        {
          $addToSet: { imageAnalysisIds: new Types.ObjectId(s.analysisId) },
          $set: { latestAnalysis: { ...s, analysisId: new Types.ObjectId(s.analysisId) }, lastActivityAt: clock.now() },
          $push: { sources: { $each: fresh } },
        },
      );
    },

    async escalate(caseId, input, actor) {
      const c = await load(caseId);
      const reasons = [...new Set([...(c.escalation?.reasons ?? []), ...input.reasons])];
      const priority = input.priority && priorityRank(input.priority) > priorityRank(c.priority) ? input.priority : c.priority;
      const updated = await SupportCaseModel.findByIdAndUpdate(
        c._id,
        {
          $set: {
            'escalation.required': true,
            'escalation.reasons': reasons,
            'escalation.requestedBy': input.requestedBy,
            'escalation.requestedAt': clock.now(),
            priority,
            lastActivityAt: clock.now(),
          },
        },
        { new: true },
      ).lean();
      void actor;
      return ref(updated!);
    },

    async setAiSummary(caseId, s) {
      await SupportCaseModel.updateOne(
        { _id: new Types.ObjectId(caseId) },
        { $set: { aiSummary: { text: s.text, language: s.language, generatedAt: clock.now(), provenance: s.provenance } } },
      );
    },

    async canRead(caseId, actor) {
      if (actor.type === 'SYSTEM') return true;
      const c = await load(caseId).catch(() => null);
      if (!c) return false;
      if (actor.role === 'ADMIN') return true;
      if (actor.role === 'FARMER') return c.farmerUserId?.toHexString() === actor.userId;
      return c.assignedExpertId?.toHexString() === actor.userId;
    },

    // ----- Queries -----
    async list(a, q) {
      const filter: Record<string, unknown> = {};
      const scope = q.scope ?? (a.role === 'FARMER' ? 'mine' : 'assigned');
      if (a.role === 'FARMER') {
        filter.farmerUserId = new Types.ObjectId(a.userId);
      } else if (a.role === 'EXPERT') {
        if (scope === 'unassigned') {
          if (!a.permissions.has('case:triage') && !a.permissions.has('case:read:all')) throw Errors.forbidden();
          filter.assignedExpertId = null;
          filter.status = { $in: ['NEW', 'TRIAGED'] };
        } else if (scope === 'all') {
          if (!a.permissions.has('case:read:all')) throw Errors.forbidden();
        } else {
          filter.assignedExpertId = new Types.ObjectId(a.userId);
          filter.status = scope === 'resolved' ? { $in: ['RESOLVED', 'CLOSED'] } : { $in: [...OPEN_STATUSES] };
        }
      } else if (scope === 'unassigned') {
        filter.assignedExpertId = null;
        filter.status = { $in: ['NEW', 'TRIAGED'] };
      } else if (scope === 'resolved') {
        filter.status = { $in: ['RESOLVED', 'CLOSED'] };
      }
      if (q.status) filter.status = q.status;
      if (q.priority) filter.priority = q.priority;
      if (q.cropKey) filter.cropKey = q.cropKey;
      if (q.q) {
        const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
        filter.$or = [{ caseNumber: rx }, { symptomsText: rx }];
      }
      const { skip, limit } = toSkipLimit(q);
      const [rows, total] = await Promise.all([
        SupportCaseModel.find(filter).sort({ lastActivityAt: -1 }).skip(skip).limit(limit).lean(),
        SupportCaseModel.countDocuments(filter),
      ]);
      const experts = await namesOf(rows.map((r) => r.assignedExpertId));
      return { items: (rows as CaseLean[]).map((r) => summary(r, experts)), pagination: buildPaginationMeta(q, total) };
    },

    async detail(a, id) {
      const { c, access } = await loadAccessible(a, id);
      const full = access === 'FULL';
      const farmerView = a.role === 'FARMER';
      const [analyses, messages, assessments, callbacks, experts] = await Promise.all([
        ImageAnalysisModel.find({ caseId: c._id }).sort({ createdAt: -1 }).limit(20).lean(),
        full ? CaseMessageModel.find({ caseId: c._id, ...(farmerView ? { visibility: 'FARMER_VISIBLE' } : {}) }).sort({ createdAt: 1 }).limit(200).lean() : [],
        full ? ExpertAssessmentModel.find({ caseId: c._id, ...(farmerView ? { visibleToFarmer: true } : {}) }).sort({ createdAt: -1 }).lean() : [],
        full ? CallbackRequestModel.find({ caseId: c._id }).sort({ createdAt: -1 }).lean() : [],
        namesOf([c.assignedExpertId]),
      ]);
      const people = await namesOf([...messages.map((m) => m.authorUserId), ...assessments.map((x) => x.expertId), c.farmerUserId]);
      let farmer: CaseDetailDto['farmer'];
      if (full && !farmerView && c.farmerUserId) {
        const u = await UserModel.findById(c.farmerUserId, { name: 1, phone: 1 }).lean();
        farmer = { name: u?.name, phoneMasked: u?.phone?.last4 ? maskPhone(u.phone.last4) : undefined };
      }
      const kinds = kindsFor(a, c);
      const allowedTransitions = (['TRIAGED', 'IN_REVIEW', 'WAITING_FOR_FARMER', 'CALLBACK_PENDING', 'RESOLVED', 'CLOSED'] as CaseStatus[]).filter(
        (to) => checkTransition(c.status as CaseStatus, to, kinds, 'x') === null,
      );
      return {
        ...summary(c, experts),
        view: access,
        symptomsText: c.symptomsText ?? undefined,
        district: full ? (c.district ?? undefined) : undefined,
        farmer,
        escalation: { required: Boolean(c.escalation?.required), reasons: c.escalation?.reasons ?? [] },
        aiSummary: c.aiSummary?.text
          ? { text: c.aiSummary.text, language: c.aiSummary.language ?? undefined, provider: c.aiSummary.provenance?.provider, simulated: c.aiSummary.provenance?.simulated, label: 'AI-generated summary — not an expert diagnosis' }
          : undefined,
        sources: (c.sources ?? []) as SourceRef[],
        analyses: analyses.map((x) => ({
          id: x._id.toHexString(),
          status: x.status ?? 'PENDING',
          outcome: x.outcome ?? undefined,
          model: { name: x.model?.name ?? undefined, version: x.model?.version ?? undefined, simulated: x.model?.simulated ?? undefined },
          predictions: (x.predictions ?? []).map((p) => ({ label: p.label ?? undefined, diseaseKey: p.diseaseKey ?? undefined, score: p.score })),
          qualityIssues: x.quality?.issues ?? [],
          outOfDomain: x.outOfDomain?.flagged ?? undefined,
          guidance: x.guidance ? { text: x.guidance.text ?? undefined, sources: (x.guidance.sources ?? []) as SourceRef[], escalationRecommended: x.guidance.escalationRecommended ?? undefined } : undefined,
          imageFileId: x.fileId.toHexString(),
          createdAt: x.createdAt?.toISOString(),
        })),
        messages: messages.map((m) => ({
          id: m._id.toHexString(),
          authorRole: m.authorRole,
          authorName: m.authorUserId ? people.get(m.authorUserId.toHexString()) : undefined,
          text: m.text,
          internal: m.visibility === 'INTERNAL',
          createdAt: m.createdAt?.toISOString(),
        })),
        assessments: assessments.map((x) => ({
          id: x._id.toHexString(),
          expertName: people.get(x.expertId.toHexString()),
          diagnosis: x.diagnosis,
          certainty: x.certainty,
          recommendations: x.recommendations ?? '',
          aiAgreement: x.aiAgreement,
          visibleToFarmer: x.visibleToFarmer ?? true,
          createdAt: x.createdAt?.toISOString(),
        })),
        callbacks: callbacks.map((cb) => ({
          id: cb._id.toHexString(),
          status: cb.status ?? 'PENDING',
          preferredTimeWindow: cb.preferredTimeWindow ?? 'ANY',
          attempts: cb.attempts?.length ?? 0,
          createdAt: cb.createdAt?.toISOString(),
        })),
        statusHistory: full
          ? (c.statusHistory ?? []).map((h) => ({ from: h.from ?? undefined, to: h.to, byRole: h.byRole ?? undefined, at: h.at.toISOString(), note: farmerView ? undefined : (h.note ?? undefined) }))
          : [],
        allowedTransitions,
      };
    },

    // ----- Farmer actions -----
    async createManual(a, input) {
      return service.createCase(
        { origin: 'MANUAL', channel: 'WEB', language: input.language, farmerUserId: a.userId, cropKey: input.cropKey, cropFreeText: input.cropFreeText, symptomsText: input.symptomsText, district: input.district, escalation: { reasons: ['FARMER_REQUESTED_EXPERT'], requestedBy: 'FARMER' } },
        { type: 'USER', userId: a.userId, role: a.role },
      );
    },

    async requestExpertReview(a, id, reason) {
      const { c } = await loadAccessible(a, id, 'FULL');
      if (a.role === 'FARMER' && c.farmerUserId?.toHexString() !== a.userId) throw Errors.notFound('Case');
      const r = await service.escalate(id, { reasons: [reason?.trim() ? 'FARMER_REQUESTED_EXPERT' : 'FARMER_REQUESTED_EXPERT'], requestedBy: a.role === 'FARMER' ? 'FARMER' : 'EXPERT', priority: 'HIGH' }, { type: 'USER', userId: a.userId, role: a.role });
      if (reason?.trim()) await CaseMessageModel.create({ caseId: c._id, authorRole: a.role === 'FARMER' ? 'FARMER' : 'EXPERT', authorUserId: a.userId, text: reason.trim(), visibility: 'FARMER_VISIBLE' });
      return r;
    },

    async addMessage(a, id, text, internal) {
      const { c } = await loadAccessible(a, id, 'FULL');
      if (internal && !isStaff(a)) throw Errors.forbidden();
      if (a.role === 'EXPERT' && c.assignedExpertId?.toHexString() !== a.userId && !a.permissions.has('case:read:all')) throw Errors.forbidden();
      if (c.status === 'CLOSED') throw Errors.conflict('This case is closed');
      await CaseMessageModel.create({
        caseId: c._id,
        authorRole: a.role === 'FARMER' ? 'FARMER' : 'EXPERT',
        authorUserId: a.userId,
        text,
        visibility: internal ? 'INTERNAL' : 'FARMER_VISIBLE',
      });
      await SupportCaseModel.updateOne({ _id: c._id }, { $set: { lastActivityAt: clock.now() } });
      // A farmer's reply resumes a case that was waiting for them.
      if (a.role === 'FARMER' && c.status === 'WAITING_FOR_FARMER') await transition(c, 'IN_REVIEW', 'FARMER', a.userId, 'Farmer replied');
    },

    // ----- Expert / admin actions -----
    async assign(a, id, expertId) {
      const c = await load(id);
      const self = expertId === a.userId;
      if (a.role === 'EXPERT') {
        if (!self || !a.permissions.has('case:assign:self') || c.assignedExpertId || !(c.status === 'NEW' || c.status === 'TRIAGED')) {
          if (!a.permissions.has('case:assign')) throw Errors.forbidden('Experts can only take unassigned cases for themselves');
        }
      } else if (a.role !== 'ADMIN') {
        throw Errors.forbidden();
      }
      if (!ASSIGNABLE_STATUSES.includes(c.status as CaseStatus)) throw Errors.conflict('This case can no longer be assigned');
      if (!Types.ObjectId.isValid(expertId)) throw Errors.badRequest('Invalid expert id');
      const expert = await UserModel.findById(expertId, { role: 1, status: 1, name: 1, expertProfile: 1 }).lean();
      if (!expert || expert.role !== 'EXPERT' || expert.status !== 'ACTIVE') throw Errors.badRequest('The selected user is not an active expert');
      const open = await SupportCaseModel.countDocuments({ assignedExpertId: expert._id, status: { $in: [...OPEN_STATUSES] } });
      if (open >= (expert.expertProfile?.maxActiveCases ?? 25)) throw Errors.conflict('This expert has reached their maximum number of open cases');

      const now = clock.now();
      await ExpertAssignmentModel.updateMany({ caseId: c._id, active: true }, { $set: { active: false, endedAt: now, endReason: 'reassigned' } });
      try {
        await ExpertAssignmentModel.create({ caseId: c._id, expertId: expert._id, assignedBy: a.userId, selfAssigned: self });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw Errors.conflict('Another expert has just taken this case');
        throw err;
      }
      // Conditional on the status we read, so concurrent assignments cannot both win.
      const updated = await SupportCaseModel.findOneAndUpdate(
        { _id: c._id, status: c.status, assignedExpertId: c.assignedExpertId ?? null },
        {
          $set: { assignedExpertId: expert._id, status: 'ASSIGNED', lastActivityAt: now },
          $push: { statusHistory: { from: c.status, to: 'ASSIGNED', byUserId: a.userId, byRole: a.role, at: now, note: `Assigned to ${expert.name}` } },
        },
        { new: true },
      ).lean();
      if (!updated) {
        await ExpertAssignmentModel.updateOne({ caseId: c._id, expertId: expert._id, active: true }, { $set: { active: false, endedAt: now, endReason: 'race-lost' } });
        throw Errors.conflict('Another expert has just taken this case');
      }
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'case.assign', targetType: 'SupportCase', targetId: id, details: { expertId, selfAssigned: self } });
      return ref(updated);
    },

    async setStatus(a, id, to, note) {
      const { c } = await loadAccessible(a, id);
      const problem = checkTransition(c.status as CaseStatus, to, kindsFor(a, c), note);
      if (problem === 'INVALID') throw Errors.invalidTransition('Case', c.status, to);
      if (problem === 'FORBIDDEN') throw Errors.forbidden('You cannot make this status change');
      if (problem === 'NOTE_REQUIRED') throw Errors.validation([{ path: 'body.note', message: 'A note is required for this change' }]);
      const updated = await transition(c, to, a.role, a.userId, note);
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'case.status', targetType: 'SupportCase', targetId: id, details: { from: c.status, to } });
      return ref(updated);
    },

    async setPriority(a, id, priority) {
      const { c } = await loadAccessible(a, id);
      if (!isStaff(a)) throw Errors.forbidden();
      await SupportCaseModel.updateOne({ _id: c._id }, { $set: { priority, lastActivityAt: clock.now() } });
    },

    async addAssessment(a, id, input) {
      const { c } = await loadAccessible(a, id, 'FULL');
      if (!(a.role === 'ADMIN' || (a.role === 'EXPERT' && c.assignedExpertId?.toHexString() === a.userId && a.permissions.has('case:assess')))) {
        throw Errors.forbidden('Only the assigned expert can assess this case');
      }
      await ExpertAssessmentModel.create({ caseId: c._id, expertId: a.userId, language: c.language, ...input });
      const set: Record<string, unknown> = { lastActivityAt: clock.now() };
      if (input.aiAgreement === 'DISAGREES') set.aiFlagged = true;
      await SupportCaseModel.updateOne({ _id: c._id }, { $set: set });
      if (c.status === 'ASSIGNED') await transition(c, 'IN_REVIEW', a.role, a.userId, 'Assessment added');
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'case.assess', targetType: 'SupportCase', targetId: id, details: { certainty: input.certainty, aiAgreement: input.aiAgreement } });
    },

    async requestCallback(a, id, input) {
      const { c } = await loadAccessible(a, id, 'FULL');
      if (a.role !== 'FARMER' || c.farmerUserId?.toHexString() !== a.userId) throw Errors.forbidden('Only the farmer can request a callback for their case');
      if (c.status === 'CLOSED') throw Errors.conflict('This case is closed');
      const user = await UserModel.findById(a.userId).select('+phone.encrypted').lean();
      if (!user?.phone?.encrypted) throw Errors.badRequest('No phone number is registered for your account');
      try {
        const cb = await CallbackRequestModel.create({
          caseId: c._id,
          farmerUserId: a.userId,
          phone: { hash: user.phone.hash, encrypted: user.phone.encrypted, last4: user.phone.last4 },
          language: c.language,
          preferredTimeWindow: input.preferredTimeWindow,
          reason: input.reason ?? '',
          priority: c.priority,
          source: 'WEB',
        });
        if (c.status === 'IN_REVIEW') await transition(c, 'CALLBACK_PENDING', 'SYSTEM', undefined, 'Callback requested');
        return { id: cb._id.toHexString(), created: true };
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
        const existing = await CallbackRequestModel.findOne({ caseId: c._id, status: { $in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'] } }).lean();
        return { id: existing!._id.toHexString(), created: false };
      }
    },

    async recordCallbackAttempt(a, callbackId, outcome, notes) {
      if (!Types.ObjectId.isValid(callbackId)) throw Errors.notFound('Callback');
      const cb = await CallbackRequestModel.findById(callbackId).lean();
      if (!cb) throw Errors.notFound('Callback');
      await loadAccessible(a, cb.caseId.toHexString(), 'FULL');
      if (!isStaff(a)) throw Errors.forbidden();
      if (!['PENDING', 'SCHEDULED', 'IN_PROGRESS'].includes(cb.status ?? 'PENDING')) throw Errors.conflict('This callback is already closed');
      const failedSoFar = (cb.attempts ?? []).filter((x) => x.outcome !== 'CONNECTED').length;
      const status =
        outcome === 'CONNECTED' ? 'COMPLETED' : outcome === 'WRONG_NUMBER' || failedSoFar + 1 >= 3 ? 'FAILED' : 'SCHEDULED';
      await CallbackRequestModel.updateOne(
        { _id: cb._id },
        { $push: { attempts: { at: clock.now(), byUserId: a.userId, outcome, notes } }, $set: { status, ...(status === 'COMPLETED' ? { completedAt: clock.now() } : {}) } },
      );
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'callback.attempt', targetType: 'CallbackRequest', targetId: callbackId, details: { outcome, status } });
    },

    async revealContact(a, id) {
      const { c } = await loadAccessible(a, id, 'FULL');
      if (!a.permissions.has('farmer-contact:reveal') || (a.role === 'EXPERT' && c.assignedExpertId?.toHexString() !== a.userId)) throw Errors.forbidden();
      if (!c.farmerUserId) throw Errors.notFound('Contact');
      const u = await UserModel.findById(c.farmerUserId).select('+phone.encrypted').lean();
      if (!u?.phone?.encrypted) throw Errors.notFound('Contact');
      await audit.record({ actor: { type: 'USER', userId: a.userId, role: a.role }, action: 'case.contact_reveal', targetType: 'SupportCase', targetId: id });
      return { phone: deps.decryptPhone(u.phone.encrypted) };
    },

    async expertDashboard(a) {
      const me = new Types.ObjectId(a.userId);
      const since7 = new Date(clock.now().getTime() - 7 * 86_400_000);
      const since24 = new Date(clock.now().getTime() - 86_400_000);
      const [assignedOpen, unassigned, resolved7, myCallbacks, failedAnalyses24h, flagged] = await Promise.all([
        SupportCaseModel.countDocuments({ assignedExpertId: me, status: { $in: [...OPEN_STATUSES] } }),
        SupportCaseModel.countDocuments({ assignedExpertId: null, status: { $in: ['NEW', 'TRIAGED'] } }),
        SupportCaseModel.countDocuments({ assignedExpertId: me, 'resolution.resolvedAt': { $gte: since7 } }),
        CallbackRequestModel.countDocuments({ caseId: { $in: await SupportCaseModel.find({ assignedExpertId: me }).distinct('_id') }, status: { $in: ['PENDING', 'SCHEDULED'] } }),
        ImageAnalysisModel.countDocuments({ status: 'FAILED', createdAt: { $gte: since24 } }),
        SupportCaseModel.countDocuments({ assignedExpertId: me, aiFlagged: true, status: { $in: [...OPEN_STATUSES] } }),
      ]);
      return { assignedOpen, unassigned, resolvedLast7Days: resolved7, pendingCallbacks: myCallbacks, failedAnalysesLast24h: failedAnalyses24h, flaggedOpen: flagged };
    },

    async listExperts() {
      const experts = await UserModel.find({ role: 'EXPERT', status: 'ACTIVE' }, { name: 1, expertProfile: 1 }).sort({ name: 1 }).lean();
      const counts = await SupportCaseModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { assignedExpertId: { $in: experts.map((e) => e._id) }, status: { $in: [...OPEN_STATUSES] } } },
        { $group: { _id: '$assignedExpertId', n: { $sum: 1 } } },
      ]);
      const byId = new Map(counts.map((x) => [x._id.toHexString(), x.n]));
      return experts.map((e) => ({
        id: e._id.toHexString(),
        name: e.name,
        languages: e.expertProfile?.languages ?? [],
        openCases: byId.get(e._id.toHexString()) ?? 0,
        maxActiveCases: e.expertProfile?.maxActiveCases ?? 25,
      }));
    },
  };
  return service;
}
