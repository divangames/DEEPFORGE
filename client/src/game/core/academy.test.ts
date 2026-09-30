import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACADEMY_STATE,
  buildAcademyView,
  claimAcademyOperation,
  runAcademyRecruitScan,
  sanitizeAcademyState,
  startAcademyOperation,
} from './academy';

describe('Academy', () => {
  it('starts, completes and claims a timed operation', () => {
    const startAt = 1_000_000;
    let state = sanitizeAcademyState(DEFAULT_ACADEMY_STATE);
    state = startAcademyOperation(state, startAt, 0)!;
    expect(state.activeOperationId).toBe('academy-01');
    expect(claimAcademyOperation(state, startAt + 1000)).toBeNull();
    const result = claimAcademyOperation(state, state.activeEndsAt)!;
    expect(result.state.completedOperations).toBe(1);
    expect(result.state.resources.trainingModules).toBeGreaterThan(DEFAULT_ACADEMY_STATE.resources.trainingModules);
    expect(result.fragments.amount).toBeGreaterThan(0);
  });

  it('spends Recruit Data on deterministic fragment scans', () => {
    const state = sanitizeAcademyState({
      ...DEFAULT_ACADEMY_STATE,
      resources: { ...DEFAULT_ACADEMY_STATE.resources, recruitData: 200 },
    });
    const result = runAcademyRecruitScan(state, Date.now())!;
    expect(result.state.resources.recruitData).toBe(100);
    expect(result.fragments.amount).toBeGreaterThan(0);
    expect(result.state.lastRecruit?.specialistId).toBe(result.fragments.specialistId);
  });

  it('builds a 30-operation mobile-friendly view model', () => {
    const view = buildAcademyView(sanitizeAcademyState(DEFAULT_ACADEMY_STATE), Date.now(), 0);
    expect(view.operations).toHaveLength(30);
    expect(view.operations[0].available).toBe(true);
  });
});
