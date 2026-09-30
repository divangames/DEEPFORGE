import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPECIALIST_SYSTEM,
  activateSpecialist,
  advanceSpecialistTimers,
  assignSpecialist,
  getSpecialistModifiers,
  getSpecialistTrainingCost,
  sanitizeSpecialistSystem,
  trainSpecialist,
} from './specialists';

describe('Specialists', () => {
  it('assigns a starter specialist and applies passive + active multipliers', () => {
    let state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    state = assignSpecialist(state, 'rook-hale', 'rust-01', 'extraction', 0)!;
    const passive = getSpecialistModifiers(state, 'rust-01', 0, false);
    expect(passive.shaftYieldMultiplier).toBeGreaterThan(1);

    state = activateSpecialist(state, 'rook-hale', 'rust-01', 0)!;
    const active = getSpecialistModifiers(state, 'rust-01', 0, true);
    expect(active.shaftYieldMultiplier).toBeGreaterThan(passive.shaftYieldMultiplier);
  });

  it('locks specialists behind rebuild milestones', () => {
    const state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    expect(assignSpecialist(state, 'sera-knox', 'rust-01', 'lift', 3)).toBeNull();
    expect(assignSpecialist(state, 'sera-knox', 'rust-01', 'lift', 4)).not.toBeNull();
  });

  it('levels specialists and advances cooldowns', () => {
    let state = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    const beforeCost = getSpecialistTrainingCost('ion-reyes', 1);
    state = trainSpecialist(state, 'ion-reyes', 0)!;
    expect(state.profiles['ion-reyes']?.level).toBe(2);
    expect(getSpecialistTrainingCost('ion-reyes', 2)).toBeGreaterThan(beforeCost);

    state = assignSpecialist(state, 'ion-reyes', 'rust-01', 'lift', 0)!;
    state = activateSpecialist(state, 'ion-reyes', 'rust-01', 0)!;
    advanceSpecialistTimers(state, 10);
    expect(state.profiles['ion-reyes']?.activeRemaining).toBeGreaterThan(0);
    advanceSpecialistTimers(state, 1000);
    expect(state.profiles['ion-reyes']?.activeRemaining).toBe(0);
    expect(state.profiles['ion-reyes']?.cooldownRemaining).toBe(0);
  });
});
