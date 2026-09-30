import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPECIALIST_SYSTEM,
  activateSpecialist,
  advanceSpecialistTimers,
  assignSpecialist,
  getSpecialistModifiers,
  getSpecialistTrainingCost,
  grantSpecialistFragments,
  rankUpSpecialist,
  recruitSpecialist,
  sanitizeSpecialistSystem,
  trainSpecialist,
} from './specialists';

describe('Specialists Stage 10', () => {
  it('keeps starter Rook recruited and applies passive + active multipliers', () => {
    let state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    state = assignSpecialist(state, 'rook-hale', 'rust-01', 'extraction', 0)!;
    const passive = getSpecialistModifiers(state, 'rust-01', 0, false);
    expect(passive.shaftYieldMultiplier).toBeGreaterThan(1);

    state = activateSpecialist(state, 'rook-hale', 'rust-01', 0)!;
    const active = getSpecialistModifiers(state, 'rust-01', 0, true);
    expect(active.shaftYieldMultiplier).toBeGreaterThan(passive.shaftYieldMultiplier);
  });

  it('recruits specialists with fragments and ranks them up', () => {
    let state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    expect(assignSpecialist(state, 'mara-vex', 'rust-01', 'extraction', 1)).toBeNull();
    state = grantSpecialistFragments(state, 'mara-vex', 40);
    state = recruitSpecialist(state, 'mara-vex', 1)!;
    expect(state.profiles['mara-vex']?.recruited).toBe(true);
    expect(state.profiles['mara-vex']?.rank).toBe(1);
    state = rankUpSpecialist(state, 'mara-vex')!;
    expect(state.profiles['mara-vex']?.rank).toBe(2);
  });

  it('levels recruited specialists and advances cooldowns', () => {
    let state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    const beforeCost = getSpecialistTrainingCost('rook-hale', 1);
    state = trainSpecialist(state, 'rook-hale', 0)!;
    expect(state.profiles['rook-hale']?.level).toBe(2);
    expect(getSpecialistTrainingCost('rook-hale', 2)).toBeGreaterThan(beforeCost);

    state = assignSpecialist(state, 'rook-hale', 'rust-01', 'extraction', 0)!;
    state = activateSpecialist(state, 'rook-hale', 'rust-01', 0)!;
    advanceSpecialistTimers(state, 10);
    expect(state.profiles['rook-hale']?.activeRemaining).toBeGreaterThan(0);
    advanceSpecialistTimers(state, 1000);
    expect(state.profiles['rook-hale']?.activeRemaining).toBe(0);
    expect(state.profiles['rook-hale']?.cooldownRemaining).toBe(0);
  });
});
