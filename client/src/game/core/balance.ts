import type { FacilityId, ShaftId } from './types';

export const SHAFT_COUNT = 30;
export const SHAFTS_PER_BARRIER = 5;
export const INITIAL_ACCESSIBLE_DEPTH = 5;
export const INITIAL_UNLOCKED_DEPTH = 3;

export function makeShaftId(depth: number): ShaftId {
  return `shaft-${depth}`;
}

export function getShaftDepth(id: ShaftId): number {
  const depth = Number(id.slice('shaft-'.length));
  return Number.isFinite(depth) ? depth : 1;
}

export function isShaftId(id: FacilityId): id is ShaftId {
  return id.startsWith('shaft-');
}

function buildShafts() {
  const shafts = {} as Record<ShaftId, {
    name: string;
    depth: number;
    baseYield: number;
    baseDuration: number;
  }>;

  for (let depth = 1; depth <= SHAFT_COUNT; depth += 1) {
    const id = makeShaftId(depth);
    shafts[id] = {
      name: `Deck ${String(depth).padStart(2, '0')}`,
      depth,
      // Глубокие горизонты должны заметно обгонять верхние уровни.
      baseYield: 6 * Math.pow(1.62, depth - 1),
      baseDuration: Math.min(3.8, 1.45 + depth * 0.075),
    };
  }

  return shafts;
}

export const STAGE_ONE_BALANCE = {
  resourceName: 'Ferrite Ore',
  resourcePrice: 2,
  shafts: buildShafts(),
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
    growth: 1.28,
    shaftDepthCostGrowth: 1.72,
    shaftYieldPerLevel: 0.22,
    liftCapacityPerLevel: 0.26,
    hubCapacityPerLevel: 0.26,
    speedPerLevel: 0.012,
    maxSpeedReduction: 0.58,
    milestones: [
      { level: 10, multiplier: 2 },
      { level: 25, multiplier: 2 },
      { level: 50, multiplier: 3 },
      { level: 100, multiplier: 4 },
      { level: 200, multiplier: 5 },
      { level: 500, multiplier: 8 },
    ],
  },
  unlocks: {
    shaftBaseCost: 55,
    shaftGrowth: 2.15,
    barrierBaseCost: 650,
    barrierGrowth: 7.5,
    barrierDurations: [15, 30, 45, 60, 90],
  },
  idle: {
    maxOfflineSeconds: 8 * 60 * 60,
    minimumReportSeconds: 15,
    incomeMultiplier: 1,
  },
  rebuild: {
    tiers: [
      { level: 1, multiplier: 1.8, requiredDecks: 12, baseCycleRevenueRequired: 25_000 },
      { level: 2, multiplier: 3.0, requiredDecks: 16, baseCycleRevenueRequired: 150_000 },
      { level: 3, multiplier: 4.7, requiredDecks: 20, baseCycleRevenueRequired: 900_000 },
      { level: 4, multiplier: 7.0, requiredDecks: 24, baseCycleRevenueRequired: 5_000_000 },
      { level: 5, multiplier: 10.5, requiredDecks: 27, baseCycleRevenueRequired: 25_000_000 },
      { level: 6, multiplier: 16.0, requiredDecks: 30, baseCycleRevenueRequired: 120_000_000 },
    ],
  },
  managers: {
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
  },
} as const;

const NAMED_SHAFT_MANAGERS: Record<number, {
  name: string;
  role: string;
  hireCost: number;
  passiveMultiplier: number;
  abilityName: string;
  abilityMultiplier: number;
  abilityDuration: number;
  abilityCooldown: number;
}> = {
  1: {
    name: 'Mira Kane', role: 'Shift Foreman', hireCost: 24,
    passiveMultiplier: 1.10, abilityName: 'Overdrive', abilityMultiplier: 2.4,
    abilityDuration: 12, abilityCooldown: 36,
  },
  2: {
    name: 'Dax Holt', role: 'Deep Crew Lead', hireCost: 70,
    passiveMultiplier: 1.12, abilityName: 'Overdrive', abilityMultiplier: 2.5,
    abilityDuration: 12, abilityCooldown: 38,
  },
  3: {
    name: 'Yuna Voss', role: 'Extraction Chief', hireCost: 130,
    passiveMultiplier: 1.14, abilityName: 'Overdrive', abilityMultiplier: 2.6,
    abilityDuration: 12, abilityCooldown: 40,
  },
};

export function getShaftUnlockCost(depth: number): number {
  if (depth <= INITIAL_UNLOCKED_DEPTH) return 0;
  return Math.floor(STAGE_ONE_BALANCE.unlocks.shaftBaseCost * Math.pow(STAGE_ONE_BALANCE.unlocks.shaftGrowth, depth - 4));
}

export function getBarrierCost(boundaryDepth: number): number {
  const index = Math.max(0, Math.floor(boundaryDepth / SHAFTS_PER_BARRIER) - 1);
  return Math.floor(STAGE_ONE_BALANCE.unlocks.barrierBaseCost * Math.pow(STAGE_ONE_BALANCE.unlocks.barrierGrowth, index));
}

export function getBarrierDuration(boundaryDepth: number): number {
  const index = Math.max(0, Math.floor(boundaryDepth / SHAFTS_PER_BARRIER) - 1);
  const list = STAGE_ONE_BALANCE.unlocks.barrierDurations;
  return list[Math.min(index, list.length - 1)];
}

export function getManagerConfig(id: FacilityId) {
  if (id === 'lift') return STAGE_ONE_BALANCE.managers.lift;
  if (id === 'hub') return STAGE_ONE_BALANCE.managers.hub;

  const depth = getShaftDepth(id);
  const named = NAMED_SHAFT_MANAGERS[depth];
  if (named) return named;

  const hireCost = Math.max(90, Math.floor(getShaftUnlockCost(depth) * 0.42));
  const tier = Math.floor((depth - 1) / 5);
  return {
    name: `Foreman ${String(depth).padStart(2, '0')}`,
    role: `Depth Crew · Tier ${tier + 1}`,
    hireCost,
    passiveMultiplier: 1.10 + Math.min(0.10, tier * 0.015),
    abilityName: 'Overdrive',
    abilityMultiplier: 2.35 + Math.min(0.65, tier * 0.1),
    abilityDuration: 12,
    abilityCooldown: 38 + tier * 2,
  };
}


export function getRebuildMultiplier(level: number): number {
  if (level <= 0) return 1;
  const tiers = STAGE_ONE_BALANCE.rebuild.tiers;
  const tier = tiers.find((entry) => entry.level === Math.floor(level)) ?? tiers[tiers.length - 1];
  return tier.multiplier;
}

export function getNextRebuildTier(level: number) {
  return STAGE_ONE_BALANCE.rebuild.tiers.find((entry) => entry.level === Math.floor(level) + 1) ?? null;
}

export function getRebuildRevenueRequirement(level: number, resourcePrice: number): number {
  const tier = getNextRebuildTier(level);
  if (!tier) return 0;
  // Более дорогие месторождения требуют чуть больше выручки за цикл Rebuild, но рост мягкий.
  const economyScale = Math.max(1, Math.sqrt(Math.max(1, resourcePrice) / 2));
  return Math.floor(tier.baseCycleRevenueRequired * economyScale);
}
