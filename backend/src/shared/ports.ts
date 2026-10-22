/**
 * Cross-module contracts ("ports"). A module that needs another module's
 * behaviour depends on one of these interfaces, never on the other module's
 * internals. This lets modules be built and tested independently (with fakes)
 * and wired together in src/bootstrap.ts.
 */
import type {
  AnalysisOutcome,
  CallbackSource,
  CallbackStatus,
  CaseOrigin,
  CasePriority,
  CaseStatus,
  Channel,
  FilePurpose,
  KnowledgeTopic,
  Role,
  TrustStatus,
} from './constants.js';

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

export type ActorRef = { type: 'USER'; userId: string; role: Role } | { type: 'SYSTEM' };

// ---------------------------------------------------------------------------
// Sources (citations) — mirrors sourceRefSchema in db/schema-helpers.ts
// ---------------------------------------------------------------------------

export interface SourceRef {
  chunkId?: string;
  documentId?: string;
  docKey?: string;
  docVersion?: number;
  title?: string;
  sourceOrganization?: string;
  sourceUrl?: string;
  trustStatus?: string;
  heading?: string;
}

// ---------------------------------------------------------------------------
// Knowledge retrieval (implemented by modules/knowledge)
// ---------------------------------------------------------------------------

export interface RetrievalQuery {
  /** Free text in any supported language (farmer question, symptoms, disease names). */
  text: string;
  /** Farmer's language; passages in this language are preferred when relevant. */
  language: string;
  /** Restrict to passages about these crops (passages with no crop tag are general and still eligible). */
  cropKeys?: string[];
  /** Boost passages about these diseases (e.g. image-model candidates). */
  diseaseKeys?: string[];
  topics?: KnowledgeTopic[];
  /** Default 5, max 20. */
  limit?: number;
  /** Lowest acceptable trust level. DRAFT and RETIRED content is never returned. Default UNREVIEWED_SOURCE_SUMMARY. */
  minTrust?: Extract<TrustStatus, 'UNREVIEWED_SOURCE_SUMMARY' | 'EXPERT_REVIEWED'>;
}

export interface RetrievedPassage {
  chunkId: string;
  documentId: string;
  docKey: string;
  docVersion: number;
  title: string;
  heading: string;
  text: string;
  sourceOrganization: string;
  sourceUrl?: string;
  crops: string[];
  diseases: string[];
  topics: string[];
  language: string;
  trustStatus: TrustStatus;
  containsDosage: boolean;
  /** Retrieval relevance score (higher is better). Not a measure of truth. */
  score: number;
  matchedTerms: string[];
}

export interface KnowledgeRetriever {
  retrieve(query: RetrievalQuery): Promise<RetrievedPassage[]>;
}

export function passageToSourceRef(p: RetrievedPassage): SourceRef {
  return {
    chunkId: p.chunkId,
    documentId: p.documentId,
    docKey: p.docKey,
    docVersion: p.docVersion,
    title: p.title,
    sourceOrganization: p.sourceOrganization,
    sourceUrl: p.sourceUrl,
    trustStatus: p.trustStatus,
    heading: p.heading,
  };
}

// ---------------------------------------------------------------------------
// Support cases (implemented by modules/cases)
// ---------------------------------------------------------------------------

export interface CreateCaseInput {
  origin: CaseOrigin;
  channel: Channel;
  language: string;
  farmerUserId?: string;
  farmerProfileId?: string;
  cropKey?: string;
  cropFreeText?: string;
  symptomsText?: string;
  district?: string;
  state?: string;
  priority?: CasePriority;
  conversationId?: string;
  callSessionId?: string;
  escalation?: { reasons: string[]; requestedBy: 'FARMER' | 'SYSTEM' | 'EXPERT' | 'ADMIN' };
  sources?: SourceRef[];
  isDemo?: boolean;
}

export interface CaseRef {
  id: string;
  caseNumber: string;
  status: CaseStatus;
}

export interface AnalysisSummary {
  analysisId: string;
  outcome: AnalysisOutcome;
  topClassKey?: string;
  topLabel?: string;
  topScore?: number;
  modelName?: string;
  modelVersion?: string;
  simulated: boolean;
}

export interface AiTextProvenance {
  provider: string;
  model?: string;
  simulated: boolean;
  promptTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}

export interface CasePort {
  createCase(input: CreateCaseInput, actor: ActorRef): Promise<CaseRef>;
  attachImageAnalysis(caseId: string, summary: AnalysisSummary, sources: SourceRef[]): Promise<void>;
  /** Mark a case as needing expert attention; idempotent for repeated reasons. */
  escalate(
    caseId: string,
    input: { reasons: string[]; requestedBy: 'FARMER' | 'SYSTEM' | 'EXPERT' | 'ADMIN'; priority?: CasePriority },
    actor: ActorRef,
  ): Promise<CaseRef>;
  setAiSummary(caseId: string, summary: { text: string; language: string; provenance: AiTextProvenance }): Promise<void>;
  /** True when the user may read the case (farmer owner, assigned/authorised expert, admin). */
  canRead(caseId: string, actor: ActorRef): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Callbacks (implemented by modules/callbacks)
// ---------------------------------------------------------------------------

export interface ProtectedPhoneValue {
  hash: string;
  encrypted: string;
  last4: string;
}

export interface CreateCallbackInput {
  caseId: string;
  phone: ProtectedPhoneValue;
  language: string;
  preferredTimeWindow?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY';
  preferredDate?: Date;
  reason?: string;
  priority?: CasePriority;
  source: CallbackSource;
  farmerUserId?: string;
  farmerProfileId?: string;
}

export interface CallbackPort {
  /** Idempotent per case: returns the existing open callback instead of creating a duplicate. */
  requestCallback(input: CreateCallbackInput, actor: ActorRef): Promise<{ id: string; status: CallbackStatus; created: boolean }>;
}

// ---------------------------------------------------------------------------
// Files / object storage (implemented by modules/files + providers/storage)
// ---------------------------------------------------------------------------

export interface StoreFileInput {
  purpose: FilePurpose;
  body: Buffer;
  contentType: string;
  ownerUserId?: string;
  caseId?: string;
  callSessionId?: string;
  /** Overrides the purpose's default retention. */
  retentionHours?: number;
}

export interface StoredFileRef {
  fileId: string;
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  contentType: string;
}

export interface FilePort {
  store(input: StoreFileInput): Promise<StoredFileRef>;
  read(fileId: string): Promise<{ body: Buffer; contentType: string }>;
  /** Short-lived URL usable without other credentials (e.g. by a telephony provider fetching audio). */
  signedUrl(fileId: string, ttlSeconds?: number): Promise<string>;
  remove(fileId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Source-grounded guidance (implemented by modules/assistant)
// ---------------------------------------------------------------------------

export interface GuidanceRequest {
  language: string;
  channel: Channel;
  /** Farmer question or symptom description (may be empty for image-only analyses). */
  question?: string;
  cropKey?: string;
  /** Image-model candidates, highest first (possibilities, not diagnoses). */
  diseaseCandidates?: Array<{ diseaseKey?: string; label: string; score: number }>;
  analysisOutcome?: AnalysisOutcome;
  conversationSummary?: string;
  /** Passages already retrieved for this request; guidance may only cite these. */
  passages: RetrievedPassage[];
  userId?: string;
}

export type GuidanceKind = 'GUIDANCE' | 'UNCERTAIN' | 'SOURCE_EXCERPTS';

export interface GuidanceResult {
  kind: GuidanceKind;
  text: string;
  language: string;
  citedChunkIds: string[];
  sources: SourceRef[];
  escalationRecommended: boolean;
  escalationReasons: string[];
  /** Machine-readable record of safety interventions, e.g. "REMOVED_UNVERIFIED_DOSAGE". */
  safetyActions: string[];
  provenance: AiTextProvenance;
}

export interface GuidancePort {
  generateGuidance(request: GuidanceRequest): Promise<GuidanceResult>;
}
