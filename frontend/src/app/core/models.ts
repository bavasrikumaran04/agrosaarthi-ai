/** Response shapes of the AgroSaarthi API (mirrors backend DTOs). */
export interface Crop {
  key: string;
  name: string;
  names: Record<string, string>;
  scientificName?: string;
  supportedByModel: boolean;
  diseaseCount?: number;
}
export interface Disease {
  key: string;
  cropKey: string;
  type: 'FUNGAL' | 'BACTERIAL' | 'VIRAL' | 'PEST' | 'NUTRIENT' | 'PHYSIOLOGICAL' | 'HEALTHY' | 'OTHER';
  name: string;
  causalAgent?: string;
}
export interface CropDetail extends Crop {
  diseases: Disease[];
}
export interface SourceRef {
  title?: string;
  sourceOrganization?: string;
  sourceUrl?: string;
  trustStatus?: string;
  heading?: string;
}
export type Outcome = 'LIKELY_MATCH' | 'UNCERTAIN' | 'OUT_OF_DOMAIN' | 'POOR_QUALITY' | 'UNSUPPORTED_CROP';
export interface Analysis {
  id: string;
  caseId: string;
  caseNumber?: string;
  status: string;
  outcome?: Outcome;
  simulated: boolean;
  model: { name?: string; version?: string };
  predictions: Array<{ classKey: string; cropKey?: string; diseaseKey?: string; label: string; score: number }>;
  qualityIssues: string[];
  outOfDomain: boolean;
  escalationRecommended: boolean;
  guidance?: { text: string; sources: SourceRef[]; simulated: boolean; kind: string };
  imageFileId: string;
}
export type CaseStatus = 'NEW' | 'TRIAGED' | 'ASSIGNED' | 'IN_REVIEW' | 'WAITING_FOR_FARMER' | 'CALLBACK_PENDING' | 'RESOLVED' | 'CLOSED';
export interface CaseSummary {
  id: string;
  caseNumber: string;
  status: CaseStatus;
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
export interface CaseDetail extends CaseSummary {
  view: 'FULL' | 'TRIAGE';
  symptomsText?: string;
  district?: string;
  farmer?: { name?: string; phoneMasked?: string };
  escalation: { required: boolean; reasons: string[] };
  aiSummary?: { text: string; label: string; simulated?: boolean };
  sources: SourceRef[];
  analyses: Array<{
    id: string;
    status: string;
    outcome?: Outcome;
    model: { name?: string; version?: string; simulated?: boolean };
    predictions: Array<{ label?: string; diseaseKey?: string; score: number }>;
    qualityIssues: string[];
    outOfDomain?: boolean;
    guidance?: { text?: string; sources: SourceRef[] };
    imageFileId: string;
    createdAt?: string;
  }>;
  messages: Array<{ id: string; authorRole: string; authorName?: string; text: string; internal: boolean; createdAt?: string }>;
  assessments: Array<{ id: string; expertName?: string; diagnosis: string; certainty: 'CONFIRMED' | 'PROBABLE' | 'UNCERTAIN'; recommendations: string; aiAgreement: string; visibleToFarmer: boolean; createdAt?: string }>;
  callbacks: Array<{ id: string; status: string; preferredTimeWindow: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY'; attempts: number; createdAt?: string }>;
  statusHistory: Array<{ from?: string; to: string; byRole?: string; at: string; note?: string }>;
  allowedTransitions: CaseStatus[];
}
