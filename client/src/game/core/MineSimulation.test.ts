import { describe, expect, it } from 'vitest';
import { MineSimulation } from './MineSimulation';
import type { PersistentMineState } from './types';

function runFor(sim: MineSimulation, seconds: number) {
  const step = 0.1;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) sim.tick(step);
}

function richState(cash = 1000): PersistentMineState {
  return {
    cash,
    surfaceBuffer: 0,
    shaftLevels: { 'shaft-1': 1, 'shaft-2': 1, 'shaft-3': 1 },
    shaftBuffers: { 'shaft-1': 0, 'shaft-2': 0, 'shaft-3': 0 },
    liftLevel: 1,
    hubLevel: 1,
    totalOreMined: 0,
    totalCashEarned: 0,
  };
}

describe('MineSimulation', () => {
  it('проводит ресурс через полный ручной производственный цикл', () => {
    const sim = new MineSimulation();

    expect(sim.startMining('shaft-1')).toBe(true);
    runFor(sim, 2);
    expect(sim.getState().shafts[0].buffer).toBeGreaterThan(0);

    expect(sim.startLift()).toBe(true);
    runFor(sim, 3.2);
    expect(sim.getState().surfaceBuffer).toBeGreaterThan(0);

    expect(sim.startHub()).toBe(true);
    runFor(sim, 2.5);
    expect(sim.getState().cash).toBeGreaterThan(0);
  });

  it('не запускает один и тот же рабочий цикл дважды одновременно', () => {
    const sim = new MineSimulation();
    expect(sim.startMining('shaft-2')).toBe(true);
    expect(sim.startMining('shaft-2')).toBe(false);
  });

  it('списывает деньги и повышает уровень при улучшении', () => {
    const sim = new MineSimulation(richState(100));
    const before = sim.getState().cash;
    const cost = sim.getUpgradeCost('shaft-1');
    expect(sim.upgrade('shaft-1')).toBe(true);
    const after = sim.getState();
    expect(after.shafts[0].level).toBe(2);
    expect(after.cash).toBe(before - cost);
  });

  it('нанятый менеджер автоматически перезапускает добычу', () => {
    const sim = new MineSimulation(richState());
    expect(sim.hireManager('shaft-1')).toBe(true);
    runFor(sim, 4);
    const state = sim.getState();
    expect(state.totalOreMined).toBeGreaterThan(0);
    expect(state.shafts[0].task).not.toBeNull();
  });

  it('полностью автоматизированная цепочка сама приносит деньги', () => {
    const sim = new MineSimulation(richState(2000));
    expect(sim.hireManager('shaft-1')).toBe(true);
    expect(sim.hireManager('lift')).toBe(true);
    expect(sim.hireManager('hub')).toBe(true);
    const before = sim.getState().cash;
    runFor(sim, 18);
    expect(sim.getState().totalCashEarned).toBeGreaterThan(0);
    expect(sim.getState().cash).toBeGreaterThan(before - 118);
  });

  it('активная способность менеджера уходит на cooldown и ускоряет цикл', () => {
    const normal = new MineSimulation(richState());
    const boosted = new MineSimulation(richState());
    normal.hireManager('shaft-1');
    boosted.hireManager('shaft-1');
    expect(boosted.activateManagerAbility('shaft-1')).toBe(true);

    runFor(normal, 4);
    runFor(boosted, 4);

    expect(boosted.getState().totalOreMined).toBeGreaterThan(normal.getState().totalOreMined);
    expect(boosted.getManagerView('shaft-1').cooldownRemaining).toBeGreaterThan(0);
  });
});
