import type { CaseStatus, Role } from '../../shared/constants.js';

/**
 * Legal case status transitions. `by` lists who may perform the transition:
 *  - ASSIGNED_EXPERT: the expert currently assigned to the case
 *  - TRIAGE_EXPERT:   any expert holding case:triage (only for unassigned NEW cases)
 *  - OWNER:           the farmer who owns the case
 *  - ADMIN
 * ASSIGNED is entered only through the assignment operation, never via setStatus.
 * CLOSED is terminal.
 */
export type TransitionActor = 'ASSIGNED_EXPERT' | 'TRIAGE_EXPERT' | 'OWNER' | 'ADMIN' | 'SYSTEM';

export interface Transition {
  from: CaseStatus;
  to: CaseStatus;
  by: TransitionActor[];
  requiresNote?: boolean;
}

export const CASE_TRANSITIONS: readonly Transition[] = [
  { from: 'NEW', to: 'TRIAGED', by: ['TRIAGE_EXPERT', 'ADMIN'] },
  { from: 'ASSIGNED', to: 'IN_REVIEW', by: ['ASSIGNED_EXPERT', 'ADMIN'] },
  { from: 'IN_REVIEW', to: 'WAITING_FOR_FARMER', by: ['ASSIGNED_EXPERT', 'ADMIN'] },
  { from: 'IN_REVIEW', to: 'CALLBACK_PENDING', by: ['ASSIGNED_EXPERT', 'ADMIN', 'SYSTEM'] },
  { from: 'IN_REVIEW', to: 'RESOLVED', by: ['ASSIGNED_EXPERT', 'ADMIN'], requiresNote: true },
  { from: 'WAITING_FOR_FARMER', to: 'IN_REVIEW', by: ['ASSIGNED_EXPERT', 'OWNER', 'ADMIN', 'SYSTEM'] },
  { from: 'CALLBACK_PENDING', to: 'IN_REVIEW', by: ['ASSIGNED_EXPERT', 'ADMIN', 'SYSTEM'] },
  { from: 'RESOLVED', to: 'CLOSED', by: ['ASSIGNED_EXPERT', 'OWNER', 'ADMIN'] },
  { from: 'RESOLVED', to: 'IN_REVIEW', by: ['ASSIGNED_EXPERT', 'OWNER', 'ADMIN'] },
  // Administrative closure (duplicates, spam) from any open state.
  ...(['NEW', 'TRIAGED', 'ASSIGNED', 'IN_REVIEW', 'WAITING_FOR_FARMER', 'CALLBACK_PENDING'] as const).map(
    (from): Transition => ({ from, to: 'CLOSED', by: ['ADMIN'], requiresNote: true }),
  ),
];

export const ASSIGNABLE_STATUSES: readonly CaseStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_REVIEW', 'WAITING_FOR_FARMER', 'CALLBACK_PENDING'];
export const OPEN_STATUSES: readonly CaseStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_REVIEW', 'WAITING_FOR_FARMER', 'CALLBACK_PENDING'];

export function findTransition(from: CaseStatus, to: CaseStatus): Transition | undefined {
  return CASE_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function actorKinds(input: {
  role: Role | 'SYSTEM';
  isOwner: boolean;
  isAssignedExpert: boolean;
  canTriage: boolean;
  caseUnassigned: boolean;
}): TransitionActor[] {
  const kinds: TransitionActor[] = [];
  if (input.role === 'SYSTEM') return ['SYSTEM'];
  if (input.role === 'ADMIN') kinds.push('ADMIN');
  if (input.isOwner) kinds.push('OWNER');
  if (input.role === 'EXPERT' && input.isAssignedExpert) kinds.push('ASSIGNED_EXPERT');
  if (input.role === 'EXPERT' && input.canTriage && input.caseUnassigned) kinds.push('TRIAGE_EXPERT');
  return kinds;
}

/** null when allowed, otherwise the reason. */
export function checkTransition(from: CaseStatus, to: CaseStatus, kinds: TransitionActor[], note?: string): 'INVALID' | 'FORBIDDEN' | 'NOTE_REQUIRED' | null {
  const t = findTransition(from, to);
  if (!t) return 'INVALID';
  if (!t.by.some((b) => kinds.includes(b))) return 'FORBIDDEN';
  if (t.requiresNote && !note?.trim()) return 'NOTE_REQUIRED';
  return null;
}
