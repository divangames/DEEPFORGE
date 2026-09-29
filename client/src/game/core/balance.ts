import type { ShaftId } from './types';

export const STAGE_ONE_BALANCE = {
  resourceName: 'Ferrite Ore',
  resourcePrice: 2,
  shafts: {
    'shaft-1': { name: 'Deck 01', depth: 1, baseYield: 6, baseDuration: 1.55 },
    'shaft-2': { name: 'Deck 02', depth: 2, baseYield: 8, baseDuration: 1.95 },
    'shaft-3': { name: 'Deck 03', depth: 3, baseYield: 10, baseDuration: 2.35 },
  } satisfies Record<ShaftId, { name: string; depth: number; baseYield: number; baseDuration: number }>,
  lift: {
    baseCapacity: 18,
    baseDuration: 2.8,
  },
  hub: {
    baseCapacity: 14,
    baseDuration: 2.05,
  },
  upgrades: {
    shaftBaseCost: 18,
    liftBaseCost: 42,
    hubBaseCost: 36,
    growth: 1.55,
    shaftYieldPerLevel: 0.24,
    liftCapacityPerLevel: 0.28,
    hubCapacityPerLevel: 0.28,
    speedPerLevel: 0.035,
    maxSpeedReduction: 0.45,
  },
} as const;
