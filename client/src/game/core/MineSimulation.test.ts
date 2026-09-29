import { describe, expect, it } from 'vitest';
import { MineSimulation } from './MineSimulation';

function runFor(sim: MineSimulation, seconds: number) {
  const step = 0.1;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    sim.tick(step);
  }
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
    const sim = new MineSimulation({
      cash: 100,
      surfaceBuffer: 0,
      shaftLevels: { 'shaft-1': 1, 'shaft-2': 1, 'shaft-3': 1 },
      shaftBuffers: { 'shaft-1': 0, 'shaft-2': 0, 'shaft-3': 0 },
      liftLevel: 1,
      hubLevel: 1,
      totalOreMined: 0,
      totalCashEarned: 0,
    });

    const before = sim.getState().cash;
    const cost = sim.getUpgradeCost('shaft-1');
    expect(sim.upgrade('shaft-1')).toBe(true);
    const after = sim.getState();
    expect(after.shafts[0].level).toBe(2);
    expect(after.cash).toBe(before - cost);
  });
});
