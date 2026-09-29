import type { MineId } from './types';

export interface MineTuning {
  resourcePrice: number;
  yieldMultiplier: number;
  durationMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
}

export interface WorldMineDefinition {
  id: MineId;
  code: string;
  name: string;
  resourceName: string;
  description: string;
  unlockEarnedRequired: number;
  previousMineId: MineId | null;
  mapX: number;
  mapY: number;
  theme: {
    mine: number;
    surface: number;
    accent: string;
    accentSoft: string;
  };
  tuning: MineTuning;
}

export const DEFAULT_MINE_TUNING: MineTuning = {
  resourcePrice: 2,
  yieldMultiplier: 1,
  durationMultiplier: 1,
  liftCapacityMultiplier: 1,
  hubCapacityMultiplier: 1,
};

export const RUST_VALLEY_MINES: readonly WorldMineDefinition[] = [
  {
    id: 'rust-01',
    code: 'RV-01',
    name: 'Scrapline Quarry',
    resourceName: 'Ferrite Ore',
    description: 'Старая промышленная выработка на краю Ржавой долины.',
    unlockEarnedRequired: 0,
    previousMineId: null,
    mapX: 17,
    mapY: 73,
    theme: { mine: 0x171b20, surface: 0x29333a, accent: '#f0b429', accentSoft: '#5d481d' },
    tuning: { resourcePrice: 2, yieldMultiplier: 1, durationMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1 },
  },
  {
    id: 'rust-02',
    code: 'RV-02',
    name: 'Cinder Cut',
    resourceName: 'Copper Shale',
    description: 'Горячая трещина с более дорогой рудой и тяжёлыми пластами.',
    unlockEarnedRequired: 750,
    previousMineId: 'rust-01',
    mapX: 34,
    mapY: 51,
    theme: { mine: 0x211916, surface: 0x433128, accent: '#ef7d43', accentSoft: '#62311f' },
    tuning: { resourcePrice: 3.25, yieldMultiplier: 1.08, durationMultiplier: 1.05, liftCapacityMultiplier: 1.02, hubCapacityMultiplier: 1.02 },
  },
  {
    id: 'rust-03',
    code: 'RV-03',
    name: 'Iron Mesa',
    resourceName: 'Cobalt Ore',
    description: 'Высокая сухая платформа с плотными металлическими жилами.',
    unlockEarnedRequired: 18_000,
    previousMineId: 'rust-02',
    mapX: 53,
    mapY: 64,
    theme: { mine: 0x171d20, surface: 0x30414a, accent: '#6bb6d8', accentSoft: '#234a5d' },
    tuning: { resourcePrice: 5.5, yieldMultiplier: 1.18, durationMultiplier: 1.08, liftCapacityMultiplier: 1.05, hubCapacityMultiplier: 1.05 },
  },
  {
    id: 'rust-04',
    code: 'RV-04',
    name: 'Redline Chasm',
    resourceName: 'Tungsten Rock',
    description: 'Глубокий каньон, где логистика важнее сырой скорости добычи.',
    unlockEarnedRequired: 420_000,
    previousMineId: 'rust-03',
    mapX: 69,
    mapY: 38,
    theme: { mine: 0x1d171a, surface: 0x462c32, accent: '#e85d6a', accentSoft: '#5f2830' },
    tuning: { resourcePrice: 9.5, yieldMultiplier: 1.32, durationMultiplier: 1.12, liftCapacityMultiplier: 0.98, hubCapacityMultiplier: 0.95 },
  },
  {
    id: 'rust-05',
    code: 'RV-05',
    name: 'Forge Crater',
    resourceName: 'Iridium Matrix',
    description: 'Финальный объект сектора: дорогая руда и агрессивный рост экономики.',
    unlockEarnedRequired: 8_500_000,
    previousMineId: 'rust-04',
    mapX: 84,
    mapY: 20,
    theme: { mine: 0x18161f, surface: 0x38304a, accent: '#b985ff', accentSoft: '#4a3069' },
    tuning: { resourcePrice: 17, yieldMultiplier: 1.48, durationMultiplier: 1.15, liftCapacityMultiplier: 1.04, hubCapacityMultiplier: 1.02 },
  },
] as const;

export const DEFAULT_MINE_ID: MineId = 'rust-01';

export function getMineDefinition(id: MineId): WorldMineDefinition {
  return RUST_VALLEY_MINES.find((mine) => mine.id === id) ?? RUST_VALLEY_MINES[0];
}

export function getMineIndex(id: MineId): number {
  return Math.max(0, RUST_VALLEY_MINES.findIndex((mine) => mine.id === id));
}
