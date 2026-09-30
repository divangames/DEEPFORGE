import type { MineId } from './types';

export type SpecialistId = 'rook-hale' | 'mara-vex' | 'ion-reyes' | 'talia-cruz' | 'kael-soren' | 'sera-knox';
export type SpecialistRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type SpecialistRole = 'extraction' | 'lift' | 'logistics' | 'universal';
export type SpecialistSlot = 'extraction' | 'lift' | 'logistics';

export interface SpecialistDefinition {
  id: SpecialistId;
  name: string;
  codename: string;
  rarity: SpecialistRarity;
  role: SpecialistRole;
  unlockRebuilds: number;
  baseTrainingCost: number;
  passiveLabel: string;
  passiveBaseBonus: number;
  abilityName: string;
  abilityBaseMultiplier: number;
  abilityDuration: number;
  abilityCooldown: number;
}

export interface PersistentSpecialistProfile {
  level: number;
  activeRemaining: number;
  cooldownRemaining: number;
}

export interface PersistentSpecialistSystem {
  profiles: Partial<Record<SpecialistId, PersistentSpecialistProfile>>;
  assignments: Partial<Record<MineId, Partial<Record<SpecialistSlot, SpecialistId>>>>;
}

export interface SpecialistModifiers {
  shaftYieldMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
  incomeMultiplier: number;
}

export interface SpecialistView {
  id: SpecialistId;
  name: string;
  codename: string;
  rarity: SpecialistRarity;
  role: SpecialistRole;
  level: number;
  maxLevel: number;
  unlocked: boolean;
  unlockRebuilds: number;
  trainingCost: number;
  canTrain: boolean;
  assignedMineId: MineId | null;
  assignedSlot: SpecialistSlot | null;
  assignedHere: boolean;
  passiveLabel: string;
  passiveBonusPercent: number;
  abilityName: string;
  abilityMultiplier: number;
  abilityDuration: number;
  activeRemaining: number;
  cooldownRemaining: number;
  abilityReady: boolean;
}

export interface SpecialistSlotView {
  slot: SpecialistSlot;
  label: string;
  specialistId: SpecialistId | null;
  specialistName: string | null;
}

export interface SpecialistSystemView {
  roster: SpecialistView[];
  slots: SpecialistSlotView[];
  totalRebuilds: number;
  assignedCount: number;
}

export const SPECIALIST_MAX_LEVEL = 10;

export const SPECIALIST_SLOTS: readonly { id: SpecialistSlot; label: string }[] = [
  { id: 'extraction', label: 'Extraction' },
  { id: 'lift', label: 'Cargo Lift' },
  { id: 'logistics', label: 'Logistics' },
] as const;

export const SPECIALISTS: readonly SpecialistDefinition[] = [
  {
    id: 'rook-hale', name: 'Rook Hale', codename: 'ROOK', rarity: 'COMMON', role: 'extraction', unlockRebuilds: 0,
    baseTrainingCost: 1_200, passiveLabel: 'Добыча всех Deck', passiveBaseBonus: 0.08,
    abilityName: 'Hammer Shift', abilityBaseMultiplier: 2.0, abilityDuration: 24, abilityCooldown: 72,
  },
  {
    id: 'mara-vex', name: 'Mara Vex', codename: 'VEX', rarity: 'RARE', role: 'extraction', unlockRebuilds: 1,
    baseTrainingCost: 4_000, passiveLabel: 'Добыча всех Deck', passiveBaseBonus: 0.14,
    abilityName: 'Core Surge', abilityBaseMultiplier: 2.75, abilityDuration: 18, abilityCooldown: 92,
  },
  {
    id: 'ion-reyes', name: 'Ion Reyes', codename: 'ION', rarity: 'EPIC', role: 'lift', unlockRebuilds: 0,
    baseTrainingCost: 2_200, passiveLabel: 'Вместимость Cargo Lift', passiveBaseBonus: 0.12,
    abilityName: 'Vertical Burn', abilityBaseMultiplier: 3.0, abilityDuration: 16, abilityCooldown: 88,
  },
  {
    id: 'talia-cruz', name: 'Talia Cruz', codename: 'CRUZ', rarity: 'RARE', role: 'logistics', unlockRebuilds: 0,
    baseTrainingCost: 2_000, passiveLabel: 'Пропускная способность Logistics', passiveBaseBonus: 0.11,
    abilityName: 'Rush Dispatch', abilityBaseMultiplier: 2.6, abilityDuration: 20, abilityCooldown: 84,
  },
  {
    id: 'kael-soren', name: 'Kael Soren', codename: 'SOREN', rarity: 'EPIC', role: 'logistics', unlockRebuilds: 2,
    baseTrainingCost: 7_500, passiveLabel: 'Пропускная способность Logistics', passiveBaseBonus: 0.18,
    abilityName: 'Freight Cascade', abilityBaseMultiplier: 3.35, abilityDuration: 17, abilityCooldown: 98,
  },
  {
    id: 'sera-knox', name: 'Sera Knox', codename: 'KNOX', rarity: 'LEGENDARY', role: 'universal', unlockRebuilds: 4,
    baseTrainingCost: 18_000, passiveLabel: 'Все производственные звенья', passiveBaseBonus: 0.10,
    abilityName: 'Command Net', abilityBaseMultiplier: 1.9, abilityDuration: 26, abilityCooldown: 118,
  },
] as const;

const DEF_MAP = new Map(SPECIALISTS.map((item) => [item.id, item]));

export const DEFAULT_SPECIALIST_SYSTEM: PersistentSpecialistSystem = {
  profiles: {},
  assignments: {},
};

export function getSpecialistDefinition(id: SpecialistId): SpecialistDefinition {
  return DEF_MAP.get(id) ?? SPECIALISTS[0];
}

export function createDefaultSpecialistProfile(): PersistentSpecialistProfile {
  return { level: 1, activeRemaining: 0, cooldownRemaining: 0 };
}

export function sanitizeSpecialistSystem(value?: Partial<PersistentSpecialistSystem> | null): PersistentSpecialistSystem {
  const profiles: PersistentSpecialistSystem['profiles'] = {};
  const rawProfiles = value?.profiles ?? {};
  for (const definition of SPECIALISTS) {
    const source = rawProfiles[definition.id];
    profiles[definition.id] = {
      level: Math.max(1, Math.min(SPECIALIST_MAX_LEVEL, Math.floor(Number(source?.level) || 1))),
      activeRemaining: Math.max(0, Number(source?.activeRemaining) || 0),
      cooldownRemaining: Math.max(0, Number(source?.cooldownRemaining) || 0),
    };
  }

  const assignments: PersistentSpecialistSystem['assignments'] = {};
  for (const [mineId, raw] of Object.entries(value?.assignments ?? {}) as [MineId, Partial<Record<SpecialistSlot, SpecialistId>>][]) {
    const next: Partial<Record<SpecialistSlot, SpecialistId>> = {};
    for (const slot of SPECIALIST_SLOTS) {
      const id = raw?.[slot.id];
      if (id && DEF_MAP.has(id) && isRoleCompatible(getSpecialistDefinition(id).role, slot.id)) next[slot.id] = id;
    }
    if (Object.keys(next).length > 0) assignments[mineId] = next;
  }

  // Один Specialist может быть назначен только в одно место во всём мире.
  const seen = new Set<SpecialistId>();
  for (const mineId of Object.keys(assignments) as MineId[]) {
    const mineAssignments = assignments[mineId];
    if (!mineAssignments) continue;
    for (const slot of SPECIALIST_SLOTS) {
      const id = mineAssignments[slot.id];
      if (!id) continue;
      if (seen.has(id)) delete mineAssignments[slot.id];
      else seen.add(id);
    }
  }

  return { profiles, assignments };
}

export function isRoleCompatible(role: SpecialistRole, slot: SpecialistSlot): boolean {
  return role === 'universal' || role === slot;
}

export function getSpecialistLevelPassiveBonus(definition: SpecialistDefinition, level: number): number {
  return definition.passiveBaseBonus * (1 + Math.max(0, level - 1) * 0.08);
}

export function getSpecialistLevelAbilityMultiplier(definition: SpecialistDefinition, level: number): number {
  return 1 + (definition.abilityBaseMultiplier - 1) * (1 + Math.max(0, level - 1) * 0.05);
}

export function getSpecialistTrainingCost(id: SpecialistId, level: number): number {
  const definition = getSpecialistDefinition(id);
  return Math.floor(definition.baseTrainingCost * Math.pow(1.72, Math.max(0, level - 1)));
}

export function getTotalRebuilds(mines: Iterable<{ rebuildLevel?: number } | undefined>): number {
  let total = 0;
  for (const state of mines) total += Math.max(0, Math.floor(state?.rebuildLevel ?? 0));
  return total;
}

export function isSpecialistUnlocked(id: SpecialistId, totalRebuilds: number): boolean {
  return totalRebuilds >= getSpecialistDefinition(id).unlockRebuilds;
}

export function findSpecialistAssignment(system: PersistentSpecialistSystem, id: SpecialistId): { mineId: MineId; slot: SpecialistSlot } | null {
  for (const [mineId, assignments] of Object.entries(system.assignments) as [MineId, Partial<Record<SpecialistSlot, SpecialistId>>][]) {
    for (const slot of SPECIALIST_SLOTS) if (assignments?.[slot.id] === id) return { mineId, slot: slot.id };
  }
  return null;
}

export function assignSpecialist(
  system: PersistentSpecialistSystem,
  id: SpecialistId,
  mineId: MineId,
  slot: SpecialistSlot,
  totalRebuilds: number,
): PersistentSpecialistSystem | null {
  const definition = getSpecialistDefinition(id);
  if (!isSpecialistUnlocked(id, totalRebuilds) || !isRoleCompatible(definition.role, slot)) return null;

  const next = sanitizeSpecialistSystem(system);
  for (const assignments of Object.values(next.assignments)) {
    if (!assignments) continue;
    for (const candidate of SPECIALIST_SLOTS) if (assignments[candidate.id] === id) delete assignments[candidate.id];
  }
  next.assignments[mineId] ??= {};
  next.assignments[mineId]![slot] = id;
  return next;
}

export function unassignSpecialist(system: PersistentSpecialistSystem, mineId: MineId, slot: SpecialistSlot): PersistentSpecialistSystem {
  const next = sanitizeSpecialistSystem(system);
  if (next.assignments[mineId]) delete next.assignments[mineId]![slot];
  return next;
}

export function trainSpecialist(system: PersistentSpecialistSystem, id: SpecialistId, totalRebuilds: number): PersistentSpecialistSystem | null {
  if (!isSpecialistUnlocked(id, totalRebuilds)) return null;
  const next = sanitizeSpecialistSystem(system);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile();
  if (profile.level >= SPECIALIST_MAX_LEVEL) return null;
  profile.level += 1;
  next.profiles[id] = profile;
  return next;
}

export function activateSpecialist(system: PersistentSpecialistSystem, id: SpecialistId, activeMineId: MineId, totalRebuilds: number, cooldownMultiplier = 1): PersistentSpecialistSystem | null {
  if (!isSpecialistUnlocked(id, totalRebuilds)) return null;
  const assignment = findSpecialistAssignment(system, id);
  if (!assignment || assignment.mineId !== activeMineId) return null;
  const next = sanitizeSpecialistSystem(system);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile();
  if (profile.activeRemaining > 0.001 || profile.cooldownRemaining > 0.001) return null;
  const definition = getSpecialistDefinition(id);
  profile.activeRemaining = definition.abilityDuration;
  profile.cooldownRemaining = definition.abilityCooldown * cooldownMultiplier;
  next.profiles[id] = profile;
  return next;
}

export function advanceSpecialistTimers(system: PersistentSpecialistSystem, seconds: number): void {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  if (safe <= 0) return;
  for (const definition of SPECIALISTS) {
    const profile = system.profiles[definition.id];
    if (!profile) continue;
    profile.activeRemaining = Math.max(0, profile.activeRemaining - safe);
    profile.cooldownRemaining = Math.max(0, profile.cooldownRemaining - safe);
  }
}

export function getSpecialistModifiers(
  system: PersistentSpecialistSystem,
  mineId: MineId,
  totalRebuilds: number,
  includeActive: boolean,
  passiveResearchMultiplier = 1,
): SpecialistModifiers {
  const modifiers: SpecialistModifiers = {
    shaftYieldMultiplier: 1,
    liftCapacityMultiplier: 1,
    hubCapacityMultiplier: 1,
    incomeMultiplier: 1,
  };
  const assignments = system.assignments[mineId];
  if (!assignments) return modifiers;

  for (const slotDefinition of SPECIALIST_SLOTS) {
    const id = assignments[slotDefinition.id];
    if (!id || !isSpecialistUnlocked(id, totalRebuilds)) continue;
    const definition = getSpecialistDefinition(id);
    const profile = system.profiles[id] ?? createDefaultSpecialistProfile();
    const passive = 1 + getSpecialistLevelPassiveBonus(definition, profile.level) * passiveResearchMultiplier;
    const active = includeActive && profile.activeRemaining > 0.001
      ? getSpecialistLevelAbilityMultiplier(definition, profile.level)
      : 1;
    const combined = passive * active;

    if (definition.role === 'universal') {
      modifiers.shaftYieldMultiplier *= combined;
      modifiers.liftCapacityMultiplier *= combined;
      modifiers.hubCapacityMultiplier *= combined;
      continue;
    }
    if (slotDefinition.id === 'extraction') modifiers.shaftYieldMultiplier *= combined;
    if (slotDefinition.id === 'lift') modifiers.liftCapacityMultiplier *= combined;
    if (slotDefinition.id === 'logistics') modifiers.hubCapacityMultiplier *= combined;
  }
  return modifiers;
}

export function buildSpecialistSystemView(
  system: PersistentSpecialistSystem,
  activeMineId: MineId,
  totalRebuilds: number,
  currentWallet: number,
  passiveResearchMultiplier = 1,
): SpecialistSystemView {
  const roster: SpecialistView[] = SPECIALISTS.map((definition) => {
    const profile = system.profiles[definition.id] ?? createDefaultSpecialistProfile();
    const assignment = findSpecialistAssignment(system, definition.id);
    const unlocked = isSpecialistUnlocked(definition.id, totalRebuilds);
    const trainingCost = getSpecialistTrainingCost(definition.id, profile.level);
    return {
      id: definition.id,
      name: definition.name,
      codename: definition.codename,
      rarity: definition.rarity,
      role: definition.role,
      level: profile.level,
      maxLevel: SPECIALIST_MAX_LEVEL,
      unlocked,
      unlockRebuilds: definition.unlockRebuilds,
      trainingCost,
      canTrain: unlocked && profile.level < SPECIALIST_MAX_LEVEL && currentWallet >= trainingCost,
      assignedMineId: assignment?.mineId ?? null,
      assignedSlot: assignment?.slot ?? null,
      assignedHere: assignment?.mineId === activeMineId,
      passiveLabel: definition.passiveLabel,
      passiveBonusPercent: Math.round(getSpecialistLevelPassiveBonus(definition, profile.level) * passiveResearchMultiplier * 100),
      abilityName: definition.abilityName,
      abilityMultiplier: getSpecialistLevelAbilityMultiplier(definition, profile.level),
      abilityDuration: definition.abilityDuration,
      activeRemaining: profile.activeRemaining,
      cooldownRemaining: profile.cooldownRemaining,
      abilityReady: unlocked && assignment?.mineId === activeMineId && profile.activeRemaining <= 0.001 && profile.cooldownRemaining <= 0.001,
    };
  });

  const assignments = system.assignments[activeMineId] ?? {};
  const slots: SpecialistSlotView[] = SPECIALIST_SLOTS.map((slot) => {
    const id = assignments[slot.id] ?? null;
    return {
      slot: slot.id,
      label: slot.label,
      specialistId: id,
      specialistName: id ? getSpecialistDefinition(id).name : null,
    };
  });

  return {
    roster,
    slots,
    totalRebuilds,
    assignedCount: slots.filter((slot) => slot.specialistId).length,
  };
}
