import type { SpecialistId, SpecialistRole } from './specialists';

export type EquipmentId =
  | 'reinforced-gloves'
  | 'flux-regulator'
  | 'quicklink-comms'
  | 'deepcore-drill'
  | 'vector-harness'
  | 'cargo-stabilizer'
  | 'dispatch-array'
  | 'singularity-rig';

export type EquipmentRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type CraftMaterialId = 'alloy' | 'circuits' | 'fiber';

export interface CraftMaterials {
  alloy: number;
  circuits: number;
  fiber: number;
}

export interface EquipmentDefinition {
  id: EquipmentId;
  name: string;
  slotLabel: string;
  rarity: EquipmentRarity;
  role: SpecialistRole | 'any';
  description: string;
  passiveMultiplier: number;
  abilityMultiplier: number;
  cooldownMultiplier: number;
  cost: CraftMaterials;
}

export interface PersistentEquipmentState {
  materials: CraftMaterials;
  inventory: Partial<Record<EquipmentId, number>>;
  equippedBySpecialist: Partial<Record<SpecialistId, EquipmentId>>;
  craftedCount: number;
}

export interface EquipmentSpecialistBonus {
  passiveMultiplier: number;
  abilityMultiplier: number;
  cooldownMultiplier: number;
}

export interface EquipmentItemView extends EquipmentDefinition {
  crafted: number;
  equipped: number;
  availableCopies: number;
  canCraft: boolean;
}

export interface EquipmentAssignmentView {
  specialistId: SpecialistId;
  equipmentId: EquipmentId | null;
  equipmentName: string | null;
}

export interface EquipmentView {
  materials: CraftMaterials;
  craftedCount: number;
  items: EquipmentItemView[];
  assignments: EquipmentAssignmentView[];
}

export const EQUIPMENT: readonly EquipmentDefinition[] = [
  {
    id: 'reinforced-gloves', name: 'Reinforced Gloves', slotLabel: 'Field Gear', rarity: 'COMMON', role: 'any',
    description: '+8% к пассивному эффекту Specialist.', passiveMultiplier: 1.08, abilityMultiplier: 1, cooldownMultiplier: 1,
    cost: { alloy: 18, circuits: 4, fiber: 10 },
  },
  {
    id: 'flux-regulator', name: 'Flux Regulator', slotLabel: 'Power Module', rarity: 'RARE', role: 'any',
    description: '+14% к пассивному эффекту Specialist.', passiveMultiplier: 1.14, abilityMultiplier: 1, cooldownMultiplier: 1,
    cost: { alloy: 30, circuits: 18, fiber: 8 },
  },
  {
    id: 'quicklink-comms', name: 'Quicklink Comms', slotLabel: 'Comms', rarity: 'RARE', role: 'any',
    description: '-12% к cooldown активной способности.', passiveMultiplier: 1, abilityMultiplier: 1, cooldownMultiplier: 0.88,
    cost: { alloy: 14, circuits: 28, fiber: 14 },
  },
  {
    id: 'deepcore-drill', name: 'Deepcore Drill', slotLabel: 'Tool', rarity: 'EPIC', role: 'extraction',
    description: '+18% passive и +8% active для Extraction.', passiveMultiplier: 1.18, abilityMultiplier: 1.08, cooldownMultiplier: 1,
    cost: { alloy: 55, circuits: 24, fiber: 18 },
  },
  {
    id: 'vector-harness', name: 'Vector Harness', slotLabel: 'Harness', rarity: 'EPIC', role: 'lift',
    description: '+18% passive и +8% active для Cargo Lift.', passiveMultiplier: 1.18, abilityMultiplier: 1.08, cooldownMultiplier: 1,
    cost: { alloy: 48, circuits: 30, fiber: 22 },
  },
  {
    id: 'cargo-stabilizer', name: 'Cargo Stabilizer', slotLabel: 'Stabilizer', rarity: 'EPIC', role: 'logistics',
    description: '+18% passive и +8% active для Logistics.', passiveMultiplier: 1.18, abilityMultiplier: 1.08, cooldownMultiplier: 1,
    cost: { alloy: 42, circuits: 34, fiber: 28 },
  },
  {
    id: 'dispatch-array', name: 'Dispatch Array', slotLabel: 'Neural Array', rarity: 'EPIC', role: 'any',
    description: '+8% passive, +12% active и -8% cooldown.', passiveMultiplier: 1.08, abilityMultiplier: 1.12, cooldownMultiplier: 0.92,
    cost: { alloy: 44, circuits: 52, fiber: 30 },
  },
  {
    id: 'singularity-rig', name: 'Singularity Rig', slotLabel: 'Prototype Rig', rarity: 'LEGENDARY', role: 'universal',
    description: '+20% passive, +15% active и -15% cooldown Universal Specialist.', passiveMultiplier: 1.20, abilityMultiplier: 1.15, cooldownMultiplier: 0.85,
    cost: { alloy: 90, circuits: 90, fiber: 70 },
  },
] as const;

const EQUIPMENT_MAP = new Map(EQUIPMENT.map((item) => [item.id, item]));

export const DEFAULT_EQUIPMENT_STATE: PersistentEquipmentState = {
  materials: { alloy: 40, circuits: 24, fiber: 30 },
  inventory: {},
  equippedBySpecialist: {},
  craftedCount: 0,
};

function safe(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

export function getEquipmentDefinition(id: EquipmentId) {
  return EQUIPMENT_MAP.get(id)!;
}

export function sanitizeEquipmentState(value?: Partial<PersistentEquipmentState> | null): PersistentEquipmentState {
  const materials = value?.materials;
  const inventory: PersistentEquipmentState['inventory'] = {};
  for (const item of EQUIPMENT) {
    const count = safe(value?.inventory?.[item.id], 0);
    if (count > 0) inventory[item.id] = count;
  }

  const equippedBySpecialist: PersistentEquipmentState['equippedBySpecialist'] = {};
  const used: Partial<Record<EquipmentId, number>> = {};
  for (const [specialistId, rawId] of Object.entries(value?.equippedBySpecialist ?? {}) as [SpecialistId, EquipmentId][]) {
    if (!EQUIPMENT_MAP.has(rawId)) continue;
    const available = inventory[rawId] ?? 0;
    const alreadyUsed = used[rawId] ?? 0;
    if (alreadyUsed >= available) continue;
    equippedBySpecialist[specialistId] = rawId;
    used[rawId] = alreadyUsed + 1;
  }

  return {
    materials: {
      alloy: safe(materials?.alloy, DEFAULT_EQUIPMENT_STATE.materials.alloy),
      circuits: safe(materials?.circuits, DEFAULT_EQUIPMENT_STATE.materials.circuits),
      fiber: safe(materials?.fiber, DEFAULT_EQUIPMENT_STATE.materials.fiber),
    },
    inventory,
    equippedBySpecialist,
    craftedCount: safe(value?.craftedCount, Object.values(inventory).reduce((sum, count) => sum + (count ?? 0), 0)),
  };
}

export function grantCraftMaterials(state: PersistentEquipmentState, reward: Partial<CraftMaterials>): PersistentEquipmentState {
  const next = sanitizeEquipmentState(state);
  next.materials.alloy += safe(reward.alloy);
  next.materials.circuits += safe(reward.circuits);
  next.materials.fiber += safe(reward.fiber);
  return next;
}

export function canCraftEquipment(state: PersistentEquipmentState, id: EquipmentId): boolean {
  const clean = sanitizeEquipmentState(state);
  const item = getEquipmentDefinition(id);
  return clean.materials.alloy >= item.cost.alloy
    && clean.materials.circuits >= item.cost.circuits
    && clean.materials.fiber >= item.cost.fiber;
}

export function craftEquipment(state: PersistentEquipmentState, id: EquipmentId): PersistentEquipmentState | null {
  if (!canCraftEquipment(state, id)) return null;
  const next = sanitizeEquipmentState(state);
  const item = getEquipmentDefinition(id);
  next.materials.alloy -= item.cost.alloy;
  next.materials.circuits -= item.cost.circuits;
  next.materials.fiber -= item.cost.fiber;
  next.inventory[id] = (next.inventory[id] ?? 0) + 1;
  next.craftedCount += 1;
  return next;
}

export function isEquipmentRoleCompatible(role: SpecialistRole, item: EquipmentDefinition): boolean {
  return item.role === 'any' || item.role === role || (item.role === 'universal' && role === 'universal');
}

function equippedCount(state: PersistentEquipmentState, id: EquipmentId) {
  return Object.values(state.equippedBySpecialist).filter((value) => value === id).length;
}

export function equipSpecialist(
  state: PersistentEquipmentState,
  specialistId: SpecialistId,
  specialistRole: SpecialistRole,
  equipmentId: EquipmentId,
): PersistentEquipmentState | null {
  const next = sanitizeEquipmentState(state);
  const item = getEquipmentDefinition(equipmentId);
  if (!isEquipmentRoleCompatible(specialistRole, item)) return null;

  const currentlyEquipped = next.equippedBySpecialist[specialistId];
  const used = equippedCount(next, equipmentId) - (currentlyEquipped === equipmentId ? 1 : 0);
  if ((next.inventory[equipmentId] ?? 0) <= used) return null;
  next.equippedBySpecialist[specialistId] = equipmentId;
  return next;
}

export function unequipSpecialist(state: PersistentEquipmentState, specialistId: SpecialistId): PersistentEquipmentState {
  const next = sanitizeEquipmentState(state);
  delete next.equippedBySpecialist[specialistId];
  return next;
}

export function getEquipmentSpecialistBonus(state: PersistentEquipmentState, specialistId: SpecialistId): EquipmentSpecialistBonus {
  const clean = state;
  const id = clean.equippedBySpecialist[specialistId];
  if (!id) return { passiveMultiplier: 1, abilityMultiplier: 1, cooldownMultiplier: 1 };
  const item = EQUIPMENT_MAP.get(id);
  if (!item) return { passiveMultiplier: 1, abilityMultiplier: 1, cooldownMultiplier: 1 };
  return {
    passiveMultiplier: item.passiveMultiplier,
    abilityMultiplier: item.abilityMultiplier,
    cooldownMultiplier: item.cooldownMultiplier,
  };
}

export function buildEquipmentView(state: PersistentEquipmentState): EquipmentView {
  const clean = sanitizeEquipmentState(state);
  const items = EQUIPMENT.map((item) => {
    const crafted = clean.inventory[item.id] ?? 0;
    const equipped = equippedCount(clean, item.id);
    return {
      ...item,
      crafted,
      equipped,
      availableCopies: Math.max(0, crafted - equipped),
      canCraft: canCraftEquipment(clean, item.id),
    };
  });
  const assignments = Object.entries(clean.equippedBySpecialist).map(([specialistId, equipmentId]) => ({
    specialistId: specialistId as SpecialistId,
    equipmentId: equipmentId ?? null,
    equipmentName: equipmentId ? getEquipmentDefinition(equipmentId).name : null,
  }));
  return { materials: { ...clean.materials }, craftedCount: clean.craftedCount, items, assignments };
}
