import { describe, expect, it } from 'vitest';
import { CASE_STATUSES, type CaseStatus } from '../../shared/constants.js';
import { actorKinds, CASE_TRANSITIONS, checkTransition } from './case-state-machine.js';

describe('case state machine', () => {
  it('CLOSED is terminal and ASSIGNED is only reachable by assignment', () => {
    for (const to of CASE_STATUSES) expect(checkTransition('CLOSED', to, ['ADMIN'], 'n')).toBe('INVALID');
    for (const from of CASE_STATUSES) expect(CASE_TRANSITIONS.some((t) => t.from === from && t.to === 'ASSIGNED')).toBe(false);
  });

  it('checks every pair: only listed transitions are valid', () => {
    for (const from of CASE_STATUSES) {
      for (const to of CASE_STATUSES) {
        const listed = CASE_TRANSITIONS.some((t) => t.from === from && t.to === to);
        expect(checkTransition(from as CaseStatus, to as CaseStatus, ['ADMIN', 'ASSIGNED_EXPERT', 'OWNER', 'TRIAGE_EXPERT', 'SYSTEM'], 'note') === 'INVALID').toBe(!listed);
      }
    }
  });

  it('enforces actors and required notes', () => {
    expect(checkTransition('IN_REVIEW', 'RESOLVED', ['OWNER'], 'n')).toBe('FORBIDDEN');
    expect(checkTransition('IN_REVIEW', 'RESOLVED', ['ASSIGNED_EXPERT'])).toBe('NOTE_REQUIRED');
    expect(checkTransition('IN_REVIEW', 'RESOLVED', ['ASSIGNED_EXPERT'], 'done')).toBeNull();
    expect(checkTransition('NEW', 'CLOSED', ['ASSIGNED_EXPERT'], 'spam')).toBe('FORBIDDEN');
    expect(checkTransition('RESOLVED', 'IN_REVIEW', ['OWNER'])).toBeNull();
  });

  it('derives actor kinds', () => {
    expect(actorKinds({ role: 'EXPERT', isOwner: false, isAssignedExpert: false, canTriage: true, caseUnassigned: true })).toEqual(['TRIAGE_EXPERT']);
    expect(actorKinds({ role: 'EXPERT', isOwner: false, isAssignedExpert: false, canTriage: true, caseUnassigned: false })).toEqual([]);
    expect(actorKinds({ role: 'FARMER', isOwner: true, isAssignedExpert: false, canTriage: false, caseUnassigned: true })).toEqual(['OWNER']);
  });
});
