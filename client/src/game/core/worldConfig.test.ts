import { describe, expect, it } from 'vitest';
import { MineSimulation } from './MineSimulation';
import { getMineDefinition, getSectorDefinition, WORLD_MINES, WORLD_SECTORS } from './worldConfig';

describe('Stage 6 world configuration', () => {
  it('содержит восемь секторов по пять объектов', () => {
    expect(WORLD_SECTORS).toHaveLength(8);
    expect(WORLD_MINES).toHaveLength(40);
    expect(new Set(WORLD_MINES.map((mine) => mine.id)).size).toBe(40);
    for (const sector of WORLD_SECTORS) {
      expect(sector.mines).toHaveLength(5);
      expect(sector.mines[0].previousMineId).toBeNull();
      for (let index = 1; index < sector.mines.length; index += 1) {
        expect(sector.mines[index].previousMineId).toBe(sector.mines[index - 1].id);
        expect(sector.mines[index].unlockEarnedRequired).toBeGreaterThan(sector.mines[index - 1].unlockEarnedRequired);
      }
    }
  });

  it('каждый сектор имеет собственную валюту и последовательное условие открытия', () => {
    expect(new Set(WORLD_SECTORS.map((sector) => sector.currencyCode)).size).toBe(8);
    expect(WORLD_SECTORS[0].previousSectorId).toBeNull();
    for (let index = 1; index < WORLD_SECTORS.length; index += 1) {
      expect(WORLD_SECTORS[index].previousSectorId).toBe(WORLD_SECTORS[index - 1].id);
      expect(WORLD_SECTORS[index].unlockEarnedRequired).toBeGreaterThan(0);
    }
  });

  it('разные объекты и сектора используют собственную экономическую настройку', () => {
    const first = getMineDefinition('rust-01');
    const later = getMineDefinition('storm-05');
    const firstSim = new MineSimulation(undefined, first.tuning);
    const laterSim = new MineSimulation(undefined, later.tuning);

    expect(getSectorDefinition('storm').currencyCode).not.toBe(getSectorDefinition('rust').currencyCode);
    expect(laterSim.getState().resourcePrice).toBeGreaterThan(firstSim.getState().resourcePrice);
    expect(laterSim.getShaftYield(laterSim.getState().shafts[0])).toBeGreaterThan(firstSim.getShaftYield(firstSim.getState().shafts[0]));
  });
});
