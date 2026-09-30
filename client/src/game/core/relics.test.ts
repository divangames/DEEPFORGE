import { describe, expect, it } from 'vitest';
import { DEFAULT_RELIC_STATE, evaluateRelics, getRelicModifiers } from './relics';

describe('relics', () => {
  it('unlocks achievements permanently and stacks modifiers', () => {
    const state = evaluateRelics(DEFAULT_RELIC_STATE, {
      totalRebuilds: 2,
      unlockedMines: 5,
      recruitedSpecialists: 3,
      academyCompleted: 10,
      collectionLevels: 10,
      craftedEquipment: 5,
    });
    expect(state.unlocked).toHaveLength(6);
    const modifiers = getRelicModifiers(state);
    expect(modifiers.incomeMultiplier).toBeGreaterThan(1.1);
    expect(modifiers.shaftYieldMultiplier).toBeGreaterThan(1);
    expect(modifiers.liftCapacityMultiplier).toBeGreaterThan(1);
    expect(modifiers.hubCapacityMultiplier).toBeGreaterThan(1);
  });
});
