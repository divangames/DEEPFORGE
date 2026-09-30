import { describe, expect, it } from 'vitest';
import {
  advanceWeeklyContract,
  claimWeeklyContractMilestone,
  createWeeklyContractState,
  getContractIncomePerSecond,
  getWeeklyContractDefinition,
  hireWeeklyContractManager,
  runWeeklyContractManualShift,
} from './weeklyContract';

describe('weekly contract', () => {
  const now = Date.UTC(2026, 8, 30, 0, 0, 0);

  it('создаёт недельное событие с понедельника до понедельника', () => {
    const def = getWeeklyContractDefinition(now);
    expect(def.endAt - def.startAt).toBe(7 * 24 * 60 * 60 * 1000);
    expect(new Date(def.startAt).getUTCDay()).toBe(1);
  });

  it('не даёт авто доход без трёх менеджеров', () => {
    const state = createWeeklyContractState(now);
    expect(getContractIncomePerSecond(state).income).toBe(0);
  });

  it('даёт авто доход после найма всей цепочки', () => {
    let state = createWeeklyContractState(now);
    state = { ...state, cash: 10_000 };
    for (const id of ['extraction', 'lift', 'logistics'] as const) state = hireWeeklyContractManager(state, id)!;
    expect(getContractIncomePerSecond(state).income).toBeGreaterThan(0);
    const later = advanceWeeklyContract(state, now + 60_000);
    expect(later.totalCashEarned).toBeGreaterThan(0);
  });

  it('ручная смена помогает стартовать событие', () => {
    const state = createWeeklyContractState(now);
    const next = runWeeklyContractManualShift(state);
    expect(next.cash).toBeGreaterThan(state.cash);
    expect(next.manualShifts).toBe(1);
  });

  it('milestone нельзя забрать дважды', () => {
    let state = createWeeklyContractState(now);
    state = { ...state, totalCashEarned: 1_000_000 };
    const first = claimWeeklyContractMilestone(state, 'm1');
    expect(first).not.toBeNull();
    expect(claimWeeklyContractMilestone(first!.state, 'm1')).toBeNull();
  });
});
