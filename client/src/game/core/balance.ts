import type { FacilityId, ShaftId } from './types';

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
  managers: {
    'shaft-1': {
      name: 'Mira Kane', role: 'Shift Foreman', hireCost: 24,
      passiveMultiplier: 1.10, abilityName: 'Overdrive', abilityMultiplier: 2.4,
      abilityDuration: 12, abilityCooldown: 36,
    },
    'shaft-2': {
      name: 'Dax Holt', role: 'Deep Crew Lead', hireCost: 70,
      passiveMultiplier: 1.12, abilityName: 'Overdrive', abilityMultiplier: 2.5,
      abilityDuration: 12, abilityCooldown: 38,
    },
    'shaft-3': {
      name: 'Yuna Voss', role: 'Extraction Chief', hireCost: 130,
      passiveMultiplier: 1.14, abilityName: 'Overdrive', abilityMultiplier: 2.6,
      abilityDuration: 12, abilityCooldown: 40,
    },
    lift: {
      name: 'Bruno Vale', role: 'Lift Controller', hireCost: 52,
      passiveMultiplier: 1.10, abilityName: 'Turbo Lift', abilityMultiplier: 2.35,
      abilityDuration: 10, abilityCooldown: 34,
    },
    hub: {
      name: 'Nika Cross', role: 'Dispatch Chief', hireCost: 42,
      passiveMultiplier: 1.10, abilityName: 'Rush Dispatch', abilityMultiplier: 2.2,
      abilityDuration: 10, abilityCooldown: 32,
    },
  } satisfies Record<FacilityId, {
    name: string;
    role: string;
    hireCost: number;
    passiveMultiplier: number;
    abilityName: string;
    abilityMultiplier: number;
    abilityDuration: number;
    abilityCooldown: number;
  }>,
} as const;
