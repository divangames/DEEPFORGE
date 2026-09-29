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

describe('MineSimulation core', () => {
  it('проводит ресурс через полный ручной производственный цикл', () => {
    const sim = new MineSimulation();
    expect(sim.startMining('shaft-1')).toBe(true);
    runFor(sim, 2);
    expect(sim.getState().shafts[0].buffer).toBeGreaterThan(0);

    expect(sim.startLift()).toBe(true);
    runFor(sim, 3.4);
    expect(sim.getState().surfaceBuffer).toBeGreaterThan(0);

    expect(sim.startHub()).toBe(true);
    runFor(sim, 2.6);
    expect(sim.getState().cash).toBeGreaterThan(0);
  });

  it('не запускает один и тот же рабочий цикл дважды одновременно', () => {
    const sim = new MineSimulation();
    expect(sim.startMining('shaft-2')).toBe(true);
    expect(sim.startMining('shaft-2')).toBe(false);
  });

  it('мигрирует Stage 1-3 save в шахту из 30 уровней без потери первых трех', () => {
    const sim = new MineSimulation(richState(500));
    const state = sim.getState();
    expect(state.shafts).toHaveLength(30);
    expect(state.shafts.filter((shaft) => shaft.unlocked)).toHaveLength(3);
    expect(state.barrier.maxAccessibleDepth).toBe(5);
    expect(state.shafts[0].unlocked).toBe(true);
    expect(state.shafts[3].unlocked).toBe(false);
  });

  it('списывает деньги и повышает уровень при улучшении', () => {
    const sim = new MineSimulation(richState(1000));
    const before = sim.getState().cash;
    const cost = sim.getUpgradeCost('shaft-1');
    expect(sim.upgrade('shaft-1')).toBe(true);
    expect(sim.getState().shafts[0].level).toBe(2);
    expect(sim.getState().cash).toBe(before - cost);
  });

  it('bulk upgrade покупает сразу несколько уровней одной математической операцией', () => {
    const sim = new MineSimulation(richState(1_000_000));
    const quote = sim.getBulkUpgradeQuote('shaft-1', 10);
    expect(quote.levels).toBe(10);
    expect(quote.affordable).toBe(true);
    const before = sim.getState().cash;
    expect(sim.upgradeBulk('shaft-1', 10)).toBe(true);
    expect(sim.getState().shafts[0].level).toBe(11);
    expect(sim.getState().cash).toBe(before - quote.totalCost);
  });

  it('MAX quote не тратит больше денег, чем есть у игрока', () => {
    const sim = new MineSimulation(richState(25_000));
    const quote = sim.getBulkUpgradeQuote('shaft-1', 'MAX');
    expect(quote.levels).toBeGreaterThan(0);
    expect(quote.totalCost).toBeLessThanOrEqual(sim.getState().cash);
  });

  it('milestone на 10 уровне резко увеличивает производительность', () => {
    const sim = new MineSimulation({ ...richState(50_000), shaftLevels: { 'shaft-1': 9, 'shaft-2': 1, 'shaft-3': 1 } });
    const beforeShaft = sim.getState().shafts[0];
    const beforeYield = sim.getShaftYield(beforeShaft);
    expect(sim.upgrade('shaft-1')).toBe(true);
    const afterShaft = sim.getState().shafts[0];
    const afterYield = sim.getShaftYield(afterShaft);
    expect(afterShaft.level).toBe(10);
    expect(afterYield).toBeGreaterThan(beforeYield * 1.8);
  });
});

describe('Stage 4 progression', () => {
  it('открывает Deck 04 и Deck 05 только по порядку', () => {
    const sim = new MineSimulation(richState(10_000));
    expect(sim.unlockShaft('shaft-5')).toBe(false);
    expect(sim.unlockShaft('shaft-4')).toBe(true);
    expect(sim.unlockShaft('shaft-5')).toBe(true);
    expect(sim.getUnlockedShaftCount()).toBe(5);
  });

  it('барьер после Deck 05 открывает следующую группу уровней', () => {
    const sim = new MineSimulation(richState(100_000));
    sim.unlockShaft('shaft-4');
    sim.unlockShaft('shaft-5');
    const barrier = sim.getCurrentBarrierView();
    expect(barrier?.boundaryDepth).toBe(5);
    expect(barrier?.requirementsMet).toBe(true);
    expect(sim.startBarrier()).toBe(true);
    runFor(sim, (barrier?.duration ?? 0) + 1);
    expect(sim.getState().barrier.maxAccessibleDepth).toBe(10);
    expect(sim.getFacilityStats('shaft-6').isAccessible).toBe(true);
  });

  it('барьер продолжает очищаться в офлайне', () => {
    const sim = new MineSimulation(richState(100_000));
    sim.unlockShaft('shaft-4');
    sim.unlockShaft('shaft-5');
    expect(sim.startBarrier()).toBe(true);
    sim.applyOfflineProgress(60);
    expect(sim.getState().barrier.maxAccessibleDepth).toBe(10);
  });

  it('определяет реальное узкое место производственной цепочки', () => {
    const sim = new MineSimulation(richState(1000));
    const view = sim.getBottleneckView();
    expect(view.effectiveOrePerSecond).toBeGreaterThan(0);
    expect(['shafts', 'lift', 'hub']).toContain(view.bottleneck);
    expect(view.incomePerSecond).toBeGreaterThan(0);
  });
});

describe('Managers and offline progress', () => {
  it('нанятый менеджер автоматически перезапускает добычу', () => {
    const sim = new MineSimulation(richState(5000));
    expect(sim.hireManager('shaft-1')).toBe(true);
    runFor(sim, 4);
    expect(sim.getState().totalOreMined).toBeGreaterThan(0);
    expect(sim.getState().shafts[0].task).not.toBeNull();
  });

  it('полностью автоматизированная цепочка сама приносит деньги', () => {
    const sim = new MineSimulation(richState(5000));
    sim.hireManager('shaft-1');
    sim.hireManager('lift');
    sim.hireManager('hub');
    runFor(sim, 18);
    expect(sim.getState().totalCashEarned).toBeGreaterThan(0);
  });

  it('начисляет idle-доход полностью автоматизированной цепочке', () => {
    const sim = new MineSimulation(richState(5000));
    sim.hireManager('shaft-1');
    sim.hireManager('lift');
    sim.hireManager('hub');
    const report = sim.applyOfflineProgress(60);
    expect(report.fullChainAutomated).toBe(true);
    expect(report.rewardCash).toBeGreaterThan(0);
  });

  it('не печатает деньги без автоматизированного лифта и логистики', () => {
    const sim = new MineSimulation(richState(5000));
    sim.hireManager('shaft-1');
    const report = sim.applyOfflineProgress(3600);
    expect(report.fullChainAutomated).toBe(false);
    expect(report.rewardCash).toBe(0);
  });

  it('ограничивает автономное начисление восемью часами', () => {
    const sim = new MineSimulation(richState(5000));
    sim.hireManager('shaft-1');
    sim.hireManager('lift');
    sim.hireManager('hub');
    const report = sim.applyOfflineProgress(24 * 60 * 60);
    expect(report.creditedSeconds).toBe(8 * 60 * 60);
    expect(report.capped).toBe(true);
  });
});

describe('Stage 6 shared sector wallet hooks', () => {
  it('позволяет сцене безопасно синхронизировать общий кошелек сектора', () => {
    const sim = new MineSimulation(richState(10));
    sim.setCash(12_345);
    expect(sim.getCash()).toBe(12_345);
    expect(sim.getState().cash).toBe(12_345);
    sim.setCash(-100);
    expect(sim.getCash()).toBe(0);
  });
});
