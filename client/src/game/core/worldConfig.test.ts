import { describe, expect, it } from 'vitest';
import { MineSimulation } from './MineSimulation';
import { getMineDefinition, RUST_VALLEY_MINES } from './worldConfig';

describe('Stage 5 world configuration', () => {
  it('содержит пять последовательных объектов Rust Valley с уникальными id', () => {
    expect(RUST_VALLEY_MINES).toHaveLength(5);
    expect(new Set(RUST_VALLEY_MINES.map((mine) => mine.id)).size).toBe(5);
    expect(RUST_VALLEY_MINES[0].previousMineId).toBeNull();
    for (let index = 1; index < RUST_VALLEY_MINES.length; index += 1) {
      expect(RUST_VALLEY_MINES[index].previousMineId).toBe(RUST_VALLEY_MINES[index - 1].id);
      expect(RUST_VALLEY_MINES[index].unlockEarnedRequired).toBeGreaterThan(RUST_VALLEY_MINES[index - 1].unlockEarnedRequired);
    }
  });

  it('разные объекты используют собственную экономическую настройку', () => {
    const first = getMineDefinition('rust-01');
    const fifth = getMineDefinition('rust-05');
    const firstSim = new MineSimulation(undefined, first.tuning);
    const fifthSim = new MineSimulation(undefined, fifth.tuning);

    expect(fifthSim.getState().resourcePrice).toBeGreaterThan(firstSim.getState().resourcePrice);
    expect(fifthSim.getShaftYield(fifthSim.getState().shafts[0])).toBeGreaterThan(firstSim.getShaftYield(firstSim.getState().shafts[0]));
  });
});
