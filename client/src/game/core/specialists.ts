import type { MineId } from './types';
import type { AcademyResources } from './academy';
import { getEquipmentDefinition, getEquipmentSpecialistBonus, type PersistentEquipmentState } from './equipment';

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
  recruitFragments: number;
  passiveLabel: string;
  passiveBaseBonus: number;
  abilityName: string;
  abilityBaseMultiplier: number;
  abilityDuration: number;
  abilityCooldown: number;
}

export interface PersistentSpecialistProfile {
  level: number;
  recruited: boolean;
  fragments: number;
  rank: number;
  promotion: number;
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
  levelCap: number;
  maxLevel: number;
  rank: number;
  maxRank: number;
  promotion: number;
  maxPromotion: number;
  fragments: number;
  recruitFragments: number;
  recruited: boolean;
  available: boolean;
  unlocked: boolean;
  unlockRebuilds: number;
  trainingCost: number;
  canTrain: boolean;
  rankCost: number | null;
  canRankUp: boolean;
  promotionCost: number | null;
  canPromote: boolean;
  canRecruit: boolean;
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
  equipmentId: string | null;
  equipmentName: string | null;
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
  academyResources: AcademyResources;
}

export const SPECIALIST_MAX_LEVEL = 25;
export const SPECIALIST_MAX_RANK = 5;
export const SPECIALIST_MAX_PROMOTION = 3;

export const SPECIALIST_SLOTS: readonly { id: SpecialistSlot; label: string }[] = [
  { id: 'extraction', label: 'Extraction' },
  { id: 'lift', label: 'Cargo Lift' },
  { id: 'logistics', label: 'Logistics' },
] as const;

export const SPECIALISTS: readonly SpecialistDefinition[] = [
  {
    id: 'rook-hale', name: 'Rook Hale', codename: 'ROOK', rarity: 'COMMON', role: 'extraction', unlockRebuilds: 0,
    recruitFragments: 10, passiveLabel: 'Добыча всех Deck', passiveBaseBonus: 0.08,
    abilityName: 'Hammer Shift', abilityBaseMultiplier: 2.0, abilityDuration: 24, abilityCooldown: 72,
  },
  {
    id: 'mara-vex', name: 'Mara Vex', codename: 'VEX', rarity: 'RARE', role: 'extraction', unlockRebuilds: 1,
    recruitFragments: 15, passiveLabel: 'Добыча всех Deck', passiveBaseBonus: 0.14,
    abilityName: 'Core Surge', abilityBaseMultiplier: 2.75, abilityDuration: 18, abilityCooldown: 92,
  },
  {
    id: 'ion-reyes', name: 'Ion Reyes', codename: 'ION', rarity: 'EPIC', role: 'lift', unlockRebuilds: 0,
    recruitFragments: 18, passiveLabel: 'Вместимость Cargo Lift', passiveBaseBonus: 0.12,
    abilityName: 'Vertical Burn', abilityBaseMultiplier: 3.0, abilityDuration: 16, abilityCooldown: 88,
  },
  {
    id: 'talia-cruz', name: 'Talia Cruz', codename: 'CRUZ', rarity: 'RARE', role: 'logistics', unlockRebuilds: 0,
    recruitFragments: 15, passiveLabel: 'Пропускная способность Logistics', passiveBaseBonus: 0.11,
    abilityName: 'Rush Dispatch', abilityBaseMultiplier: 2.6, abilityDuration: 20, abilityCooldown: 84,
  },
  {
    id: 'kael-soren', name: 'Kael Soren', codename: 'SOREN', rarity: 'EPIC', role: 'logistics', unlockRebuilds: 2,
    recruitFragments: 22, passiveLabel: 'Пропускная способность Logistics', passiveBaseBonus: 0.18,
    abilityName: 'Freight Cascade', abilityBaseMultiplier: 3.35, abilityDuration: 17, abilityCooldown: 98,
  },
  {
    id: 'sera-knox', name: 'Sera Knox', codename: 'KNOX', rarity: 'LEGENDARY', role: 'universal', unlockRebuilds: 4,
    recruitFragments: 30, passiveLabel: 'Все производственные звенья', passiveBaseBonus: 0.10,
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

export function createDefaultSpecialistProfile(id?: SpecialistId): PersistentSpecialistProfile {
  return {
    level: 1,
    recruited: id === 'rook-hale',
    fragments: 0,
    rank: id === 'rook-hale' ? 1 : 0,
    promotion: 0,
    activeRemaining: 0,
    cooldownRemaining: 0,
  };
}

export function getSpecialistLevelCap(profile: Pick<PersistentSpecialistProfile, 'promotion'>): number {
  return Math.min(SPECIALIST_MAX_LEVEL, 10 + Math.max(0, Math.min(SPECIALIST_MAX_PROMOTION, profile.promotion)) * 5);
}

export function sanitizeSpecialistSystem(value?: Partial<PersistentSpecialistSystem> | null): PersistentSpecialistSystem {
  const profiles: PersistentSpecialistSystem['profiles'] = {};
  const rawProfiles = value?.profiles ?? {};
  for (const definition of SPECIALISTS) {
    const source = rawProfiles[definition.id];
    const fallback = createDefaultSpecialistProfile(definition.id);
    const promotion = Math.max(0, Math.min(SPECIALIST_MAX_PROMOTION, Math.floor(Number(source?.promotion) || 0)));
    const recruited = typeof source?.recruited === 'boolean' ? source.recruited : fallback.recruited;
    const rankFallback = recruited ? 1 : 0;
    const rank = Math.max(rankFallback, Math.min(SPECIALIST_MAX_RANK, Math.floor(Number(source?.rank) || rankFallback)));
    const cap = 10 + promotion * 5;
    profiles[definition.id] = {
      level: Math.max(1, Math.min(cap, Math.floor(Number(source?.level) || 1))),
      recruited,
      fragments: Math.max(0, Math.floor(Number(source?.fragments) || 0)),
      rank,
      promotion,
      activeRemaining: Math.max(0, Number(source?.activeRemaining) || 0),
      cooldownRemaining: Math.max(0, Number(source?.cooldownRemaining) || 0),
    };
  }

  const assignments: PersistentSpecialistSystem['assignments'] = {};
  for (const [mineId, raw] of Object.entries(value?.assignments ?? {}) as [MineId, Partial<Record<SpecialistSlot, SpecialistId>>][]) {
    const next: Partial<Record<SpecialistSlot, SpecialistId>> = {};
    for (const slot of SPECIALIST_SLOTS) {
      const id = raw?.[slot.id];
      const profile = id ? profiles[id] : null;
      if (id && DEF_MAP.has(id) && profile?.recruited && isRoleCompatible(getSpecialistDefinition(id).role, slot.id)) next[slot.id] = id;
    }
    if (Object.keys(next).length > 0) assignments[mineId] = next;
  }

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

export function migrateStageNineSpecialists(value: PersistentSpecialistSystem | undefined, totalRebuilds: number): PersistentSpecialistSystem {
  const raw = value ?? DEFAULT_SPECIALIST_SYSTEM;
  const next = sanitizeSpecialistSystem(raw);
  for (const definition of SPECIALISTS) {
    const source = raw.profiles?.[definition.id];
    const legacyUnlocked = totalRebuilds >= definition.unlockRebuilds;
    const profile = next.profiles[definition.id] ?? createDefaultSpecialistProfile(definition.id);
    profile.recruited = legacyUnlocked || definition.id === 'rook-hale';
    profile.rank = profile.recruited ? Math.max(1, profile.rank) : 0;
    profile.fragments = Math.max(0, profile.fragments ?? 0);
    profile.promotion = Math.max(0, profile.promotion ?? 0);
    profile.level = Math.max(1, Math.min(getSpecialistLevelCap(profile), Math.floor(Number(source?.level) || profile.level || 1)));
    next.profiles[definition.id] = profile;
  }
  // Stage 9 assignments могли содержать Ion/Talia до появления recruited-флага.
  // Восстанавливаем их после миграции профилей и затем ещё раз валидируем роли/уникальность.
  next.assignments = Object.fromEntries(
    Object.entries(raw.assignments ?? {}).map(([mineId, assignments]) => [mineId, { ...(assignments ?? {}) }]),
  ) as PersistentSpecialistSystem['assignments'];
  return sanitizeSpecialistSystem(next);
}

export function isRoleCompatible(role: SpecialistRole, slot: SpecialistSlot): boolean {
  return role === 'universal' || role === slot;
}

export function getSpecialistLevelPassiveBonus(definition: SpecialistDefinition, level: number, rank = 1, promotion = 0): number {
  const levelScale = 1 + Math.max(0, level - 1) * 0.08;
  const rankScale = 1 + Math.max(0, rank - 1) * 0.12;
  const promotionScale = 1 + Math.max(0, promotion) * 0.10;
  return definition.passiveBaseBonus * levelScale * rankScale * promotionScale;
}

export function getSpecialistLevelAbilityMultiplier(definition: SpecialistDefinition, level: number, rank = 1, promotion = 0): number {
  const progression = (1 + Math.max(0, level - 1) * 0.05) * (1 + Math.max(0, rank - 1) * 0.08) * (1 + Math.max(0, promotion) * 0.06);
  return 1 + (definition.abilityBaseMultiplier - 1) * progression;
}

export function getSpecialistTrainingCost(id: SpecialistId, level: number): number {
  const rarityScale = getSpecialistDefinition(id).rarity === 'LEGENDARY' ? 1.65 : getSpecialistDefinition(id).rarity === 'EPIC' ? 1.35 : getSpecialistDefinition(id).rarity === 'RARE' ? 1.15 : 1;
  return Math.floor((18 + Math.max(0, level - 1) * 7) * rarityScale * Math.pow(1.08, Math.max(0, level - 1)));
}

export function getSpecialistRankCost(rank: number): number | null {
  if (rank < 1) return null;
  const costs = [0, 20, 40, 80, 160];
  return rank >= SPECIALIST_MAX_RANK ? null : costs[rank] ?? null;
}

export function getSpecialistPromotionCost(promotion: number): number | null {
  const costs = [5, 12, 25];
  return promotion >= SPECIALIST_MAX_PROMOTION ? null : costs[promotion] ?? null;
}

export function getTotalRebuilds(mines: Iterable<{ rebuildLevel?: number } | undefined>): number {
  let total = 0;
  for (const state of mines) total += Math.max(0, Math.floor(state?.rebuildLevel ?? 0));
  return total;
}

/** Доступность персонажа по прогрессу. Фактическое использование требует recruited=true. */
export function isSpecialistUnlocked(id: SpecialistId, totalRebuilds: number): boolean {
  return totalRebuilds >= getSpecialistDefinition(id).unlockRebuilds;
}

export function findSpecialistAssignment(system: PersistentSpecialistSystem, id: SpecialistId): { mineId: MineId; slot: SpecialistSlot } | null {
  for (const [mineId, assignments] of Object.entries(system.assignments) as [MineId, Partial<Record<SpecialistSlot, SpecialistId>>][]) {
    for (const slot of SPECIALIST_SLOTS) if (assignments?.[slot.id] === id) return { mineId, slot: slot.id };
  }
  return null;
}

export function grantSpecialistFragments(system: PersistentSpecialistSystem, id: SpecialistId, amount: number): PersistentSpecialistSystem {
  const next = sanitizeSpecialistSystem(system);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile(id);
  profile.fragments += Math.max(0, Math.floor(amount));
  next.profiles[id] = profile;
  return next;
}

export function recruitSpecialist(system: PersistentSpecialistSystem, id: SpecialistId, totalRebuilds: number): PersistentSpecialistSystem | null {
  if (!isSpecialistUnlocked(id, totalRebuilds)) return null;
  const next = sanitizeSpecialistSystem(system);
  const definition = getSpecialistDefinition(id);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile(id);
  if (profile.recruited || profile.fragments < definition.recruitFragments) return null;
  profile.fragments -= definition.recruitFragments;
  profile.recruited = true;
  profile.rank = 1;
  next.profiles[id] = profile;
  return next;
}

export function rankUpSpecialist(system: PersistentSpecialistSystem, id: SpecialistId): PersistentSpecialistSystem | null {
  const next = sanitizeSpecialistSystem(system);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile(id);
  if (!profile.recruited) return null;
  const cost = getSpecialistRankCost(profile.rank);
  if (cost === null || profile.fragments < cost) return null;
  profile.fragments -= cost;
  profile.rank += 1;
  next.profiles[id] = profile;
  return next;
}

export function promoteSpecialist(system: PersistentSpecialistSystem, id: SpecialistId): PersistentSpecialistSystem | null {
  const next = sanitizeSpecialistSystem(system);
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile(id);
  if (!profile.recruited || profile.promotion >= SPECIALIST_MAX_PROMOTION) return null;
  const currentCap = getSpecialistLevelCap(profile);
  if (profile.level < currentCap || profile.rank < profile.promotion + 2) return null;
  profile.promotion += 1;
  next.profiles[id] = profile;
  return next;
}

export function assignSpecialist(
  system: PersistentSpecialistSystem,
  id: SpecialistId,
  mineId: MineId,
  slot: SpecialistSlot,
  totalRebuilds: number,
): PersistentSpecialistSystem | null {
  const definition = getSpecialistDefinition(id);
  const profile = sanitizeSpecialistSystem(system).profiles[id];
  if (!isSpecialistUnlocked(id, totalRebuilds) || !profile?.recruited || !isRoleCompatible(definition.role, slot)) return null;

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
  const profile = next.profiles[id] ?? createDefaultSpecialistProfile(id);
  if (!profile.recruited || profile.level >= getSpecialistLevelCap(profile)) return null;
  profile.level += 1;
  next.profiles[id] = profile;
  return next;
}

export function activateSpecialist(system: PersistentSpecialistSystem, id: SpecialistId, activeMineId: MineId, totalRebuilds: number, cooldownMultiplier = 1, equipment?: PersistentEquipmentState): PersistentSpecialistSystem | null {
  if (!isSpecialistUnlocked(id, totalRebuilds)) return null;
  const clean = sanitizeSpecialistSystem(system);
  const profile = clean.profiles[id] ?? createDefaultSpecialistProfile(id);
  if (!profile.recruited) return null;
  const assignment = findSpecialistAssignment(clean, id);
  if (!assignment || assignment.mineId !== activeMineId) return null;
  if (profile.activeRemaining > 0.001 || profile.cooldownRemaining > 0.001) return null;
  const definition = getSpecialistDefinition(id);
  profile.activeRemaining = definition.abilityDuration;
  const gear = equipment ? getEquipmentSpecialistBonus(equipment, id) : { cooldownMultiplier: 1 };
  profile.cooldownRemaining = definition.abilityCooldown * cooldownMultiplier * gear.cooldownMultiplier;
  clean.profiles[id] = profile;
  return clean;
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
  equipment?: PersistentEquipmentState,
): SpecialistModifiers {
  const modifiers: SpecialistModifiers = {
    shaftYieldMultiplier: 1,
    liftCapacityMultiplier: 1,
    hubCapacityMultiplier: 1,
    incomeMultiplier: 1,
  };
  // Hot path: эта функция вызывается из active simulation. System уже sanitised при load/mutation,
  // поэтому не создаём новые profile/assignment objects каждый frame.
  const assignments = system.assignments[mineId];
  if (!assignments) return modifiers;

  for (const slotDefinition of SPECIALIST_SLOTS) {
    const id = assignments[slotDefinition.id];
    if (!id || !isSpecialistUnlocked(id, totalRebuilds)) continue;
    const definition = getSpecialistDefinition(id);
    const profile = system.profiles[id] ?? createDefaultSpecialistProfile(id);
    if (!profile.recruited) continue;
    const gear = equipment ? getEquipmentSpecialistBonus(equipment, id) : { passiveMultiplier: 1, abilityMultiplier: 1, cooldownMultiplier: 1 };
    const passiveBonus = getSpecialistLevelPassiveBonus(definition, profile.level, profile.rank, profile.promotion) * passiveResearchMultiplier * gear.passiveMultiplier;
    const passive = 1 + passiveBonus;
    const active = includeActive && profile.activeRemaining > 0.001
      ? 1 + (getSpecialistLevelAbilityMultiplier(definition, profile.level, profile.rank, profile.promotion) - 1) * gear.abilityMultiplier
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
  academyResources: AcademyResources,
  passiveResearchMultiplier = 1,
  equipment?: PersistentEquipmentState,
): SpecialistSystemView {
  const clean = sanitizeSpecialistSystem(system);
  const roster: SpecialistView[] = SPECIALISTS.map((definition) => {
    const profile = clean.profiles[definition.id] ?? createDefaultSpecialistProfile(definition.id);
    const assignment = findSpecialistAssignment(clean, definition.id);
    const available = isSpecialistUnlocked(definition.id, totalRebuilds);
    const trainingCost = getSpecialistTrainingCost(definition.id, profile.level);
    const rankCost = getSpecialistRankCost(profile.rank);
    const promotionCost = getSpecialistPromotionCost(profile.promotion);
    const levelCap = getSpecialistLevelCap(profile);
    const gear = equipment ? getEquipmentSpecialistBonus(equipment, definition.id) : { passiveMultiplier: 1, abilityMultiplier: 1, cooldownMultiplier: 1 };
    const equipmentId = equipment?.equippedBySpecialist[definition.id] ?? null;
    const canPromote = profile.recruited
      && promotionCost !== null
      && profile.level >= levelCap
      && profile.rank >= profile.promotion + 2
      && academyResources.promotionBadges >= promotionCost;
    return {
      id: definition.id,
      name: definition.name,
      codename: definition.codename,
      rarity: definition.rarity,
      role: definition.role,
      level: profile.level,
      levelCap,
      maxLevel: SPECIALIST_MAX_LEVEL,
      rank: profile.rank,
      maxRank: SPECIALIST_MAX_RANK,
      promotion: profile.promotion,
      maxPromotion: SPECIALIST_MAX_PROMOTION,
      fragments: profile.fragments,
      recruitFragments: definition.recruitFragments,
      recruited: profile.recruited,
      available,
      unlocked: profile.recruited,
      unlockRebuilds: definition.unlockRebuilds,
      trainingCost,
      canTrain: available && profile.recruited && profile.level < levelCap && academyResources.trainingModules >= trainingCost,
      rankCost,
      canRankUp: profile.recruited && rankCost !== null && profile.fragments >= rankCost,
      promotionCost,
      canPromote,
      canRecruit: available && !profile.recruited && profile.fragments >= definition.recruitFragments,
      assignedMineId: assignment?.mineId ?? null,
      assignedSlot: assignment?.slot ?? null,
      assignedHere: assignment?.mineId === activeMineId,
      passiveLabel: definition.passiveLabel,
      passiveBonusPercent: Math.round(getSpecialistLevelPassiveBonus(definition, profile.level, profile.rank, profile.promotion) * passiveResearchMultiplier * gear.passiveMultiplier * 100),
      abilityName: definition.abilityName,
      abilityMultiplier: 1 + (getSpecialistLevelAbilityMultiplier(definition, profile.level, profile.rank, profile.promotion) - 1) * gear.abilityMultiplier,
      abilityDuration: definition.abilityDuration,
      activeRemaining: profile.activeRemaining,
      cooldownRemaining: profile.cooldownRemaining,
      abilityReady: available && profile.recruited && assignment?.mineId === activeMineId && profile.activeRemaining <= 0.001 && profile.cooldownRemaining <= 0.001,
      equipmentId,
      equipmentName: equipmentId ? getEquipmentDefinition(equipmentId).name : null,
    };
  });

  const assignments = clean.assignments[activeMineId] ?? {};
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
    academyResources: { ...academyResources },
  };
}
