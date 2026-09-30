export type CollectionCategory = 'crew' | 'lift' | 'logistics';
export type CollectionCardId =
  | 'rust-crew' | 'deepcore-crew' | 'void-crew'
  | 'cargo-yellow' | 'cargo-ion' | 'cargo-obsidian'
  | 'hauler-rust' | 'hauler-neon' | 'hauler-phantom';
export type CollectionRarity = 'COMMON' | 'RARE' | 'EPIC';

export interface CollectionCardDefinition {
  id: CollectionCardId;
  name: string;
  category: CollectionCategory;
  rarity: CollectionRarity;
  visualLabel: string;
  bonusPerLevel: number;
}

export interface PersistentCollectionCard {
  level: number;
  progress: number;
}

export interface PersistentCollectionState {
  supplyKeys: number;
  cratesOpened: number;
  cards: Partial<Record<CollectionCardId, PersistentCollectionCard>>;
  selected: Partial<Record<CollectionCategory, CollectionCardId>>;
}

export interface CollectionModifiers {
  shaftYieldMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
}

export interface CollectionCardView extends CollectionCardDefinition {
  level: number;
  maxLevel: number;
  progress: number;
  nextLevelCopies: number | null;
  owned: boolean;
  selected: boolean;
  bonusPercent: number;
}

export interface CollectionView {
  supplyKeys: number;
  cratesOpened: number;
  totalLevels: number;
  cards: CollectionCardView[];
  selected: Partial<Record<CollectionCategory, CollectionCardId>>;
  canOpenCrate: boolean;
  lastCrate: CollectionCardId[];
}

export const COLLECTION_MAX_LEVEL = 5;
const LEVEL_REQUIREMENTS = [0, 1, 2, 4, 7, 11];

export const COLLECTION_CARDS: readonly CollectionCardDefinition[] = [
  { id: 'rust-crew', name: 'Rust Crew', category: 'crew', rarity: 'COMMON', visualLabel: 'RUST WORKERS', bonusPerLevel: 0.02 },
  { id: 'deepcore-crew', name: 'Deepcore Crew', category: 'crew', rarity: 'RARE', visualLabel: 'DEEP CORE', bonusPerLevel: 0.035 },
  { id: 'void-crew', name: 'Void Crew', category: 'crew', rarity: 'EPIC', visualLabel: 'VOID TEAM', bonusPerLevel: 0.05 },
  { id: 'cargo-yellow', name: 'Yellow Cargo', category: 'lift', rarity: 'COMMON', visualLabel: 'YELLOW LIFT', bonusPerLevel: 0.02 },
  { id: 'cargo-ion', name: 'Ion Cargo', category: 'lift', rarity: 'RARE', visualLabel: 'ION LIFT', bonusPerLevel: 0.035 },
  { id: 'cargo-obsidian', name: 'Obsidian Cargo', category: 'lift', rarity: 'EPIC', visualLabel: 'OBSIDIAN', bonusPerLevel: 0.05 },
  { id: 'hauler-rust', name: 'Rust Hauler', category: 'logistics', rarity: 'COMMON', visualLabel: 'RUST HAULER', bonusPerLevel: 0.02 },
  { id: 'hauler-neon', name: 'Neon Hauler', category: 'logistics', rarity: 'RARE', visualLabel: 'NEON HAULER', bonusPerLevel: 0.035 },
  { id: 'hauler-phantom', name: 'Phantom Hauler', category: 'logistics', rarity: 'EPIC', visualLabel: 'PHANTOM', bonusPerLevel: 0.05 },
] as const;

const CARD_MAP = new Map(COLLECTION_CARDS.map((item) => [item.id, item]));
const CRATE_PATTERN: readonly CollectionCardId[] = [
  'rust-crew', 'cargo-yellow', 'hauler-rust', 'deepcore-crew', 'cargo-ion', 'hauler-neon',
  'rust-crew', 'cargo-yellow', 'void-crew', 'hauler-rust', 'cargo-obsidian', 'hauler-phantom',
  'deepcore-crew', 'cargo-ion', 'hauler-neon', 'rust-crew', 'cargo-yellow', 'hauler-rust',
];

export const DEFAULT_COLLECTION_STATE: PersistentCollectionState = {
  supplyKeys: 3,
  cratesOpened: 0,
  cards: {},
  selected: {},
};

function safe(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

export function sanitizeCollectionState(value?: Partial<PersistentCollectionState> | null): PersistentCollectionState {
  const cards: PersistentCollectionState['cards'] = {};
  for (const definition of COLLECTION_CARDS) {
    const raw = value?.cards?.[definition.id];
    const level = Math.max(0, Math.min(COLLECTION_MAX_LEVEL, safe(raw?.level, 0)));
    const progress = level >= COLLECTION_MAX_LEVEL ? 0 : safe(raw?.progress, 0);
    if (level > 0 || progress > 0) cards[definition.id] = { level, progress };
  }

  const selected: PersistentCollectionState['selected'] = {};
  for (const category of ['crew', 'lift', 'logistics'] as const) {
    const id = value?.selected?.[category];
    if (id && CARD_MAP.get(id)?.category === category && (cards[id]?.level ?? 0) > 0) selected[category] = id;
  }

  return {
    supplyKeys: safe(value?.supplyKeys, DEFAULT_COLLECTION_STATE.supplyKeys),
    cratesOpened: safe(value?.cratesOpened, 0),
    cards,
    selected,
  };
}

export function grantSupplyKeys(state: PersistentCollectionState, amount: number): PersistentCollectionState {
  const next = sanitizeCollectionState(state);
  next.supplyKeys += Math.max(0, Math.floor(amount));
  return next;
}

function addCardCopy(state: PersistentCollectionState, id: CollectionCardId) {
  const definition = CARD_MAP.get(id)!;
  const current = state.cards[id] ?? { level: 0, progress: 0 };
  if (current.level === 0) {
    current.level = 1;
    current.progress = 0;
  } else if (current.level < COLLECTION_MAX_LEVEL) {
    current.progress += 1;
    const required = LEVEL_REQUIREMENTS[current.level + 1] - LEVEL_REQUIREMENTS[current.level];
    if (current.progress >= required) {
      current.level += 1;
      current.progress = 0;
    }
  }
  state.cards[id] = current;
  if (!state.selected[definition.category]) state.selected[definition.category] = id;
}

export function openSupplyCrate(state: PersistentCollectionState): { state: PersistentCollectionState; cards: CollectionCardId[] } | null {
  const next = sanitizeCollectionState(state);
  if (next.supplyKeys < 1) return null;
  next.supplyKeys -= 1;
  const base = next.cratesOpened * 3;
  const cards = [0, 1, 2].map((offset) => CRATE_PATTERN[(base + offset) % CRATE_PATTERN.length]);
  cards.forEach((id) => addCardCopy(next, id));
  next.cratesOpened += 1;
  return { state: next, cards };
}

export function selectCollectionCard(state: PersistentCollectionState, id: CollectionCardId): PersistentCollectionState | null {
  const next = sanitizeCollectionState(state);
  const definition = CARD_MAP.get(id);
  if (!definition || (next.cards[id]?.level ?? 0) <= 0) return null;
  next.selected[definition.category] = id;
  return next;
}

export function getCollectionModifiers(state: PersistentCollectionState): CollectionModifiers {
  const clean = state;
  const result: CollectionModifiers = { shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1 };
  for (const category of ['crew', 'lift', 'logistics'] as const) {
    const id = clean.selected[category];
    if (!id) continue;
    const definition = CARD_MAP.get(id);
    const level = clean.cards[id]?.level ?? 0;
    if (!definition || level <= 0) continue;
    const multiplier = 1 + definition.bonusPerLevel * level;
    if (category === 'crew') result.shaftYieldMultiplier *= multiplier;
    if (category === 'lift') result.liftCapacityMultiplier *= multiplier;
    if (category === 'logistics') result.hubCapacityMultiplier *= multiplier;
  }
  return result;
}

export function getTotalCollectionLevels(state: PersistentCollectionState): number {
  return Object.values(state.cards).reduce((sum, card) => sum + (card?.level ?? 0), 0);
}

export interface CollectionVisualPalette {
  workerColor: number;
  liftColor: number;
  hubColor: number;
}

const VISUAL_COLORS: Record<CollectionCardId, number> = {
  'rust-crew': 0xd17c35, 'deepcore-crew': 0x4f9fc7, 'void-crew': 0x8d66c4,
  'cargo-yellow': 0xf0b429, 'cargo-ion': 0x5eb5d8, 'cargo-obsidian': 0x5a506c,
  'hauler-rust': 0xcc5d46, 'hauler-neon': 0x45b991, 'hauler-phantom': 0x756aa2,
};

export function getCollectionVisualPalette(state: PersistentCollectionState): CollectionVisualPalette {
  const clean = state;
  const crew = clean.selected.crew;
  const lift = clean.selected.lift;
  const logistics = clean.selected.logistics;
  return {
    workerColor: crew ? VISUAL_COLORS[crew] : 0xd17c35,
    liftColor: lift ? VISUAL_COLORS[lift] : 0xf0b429,
    hubColor: logistics ? VISUAL_COLORS[logistics] : 0xcc5d46,
  };
}

export function buildCollectionView(state: PersistentCollectionState, lastCrate: CollectionCardId[] = []): CollectionView {
  const clean = sanitizeCollectionState(state);
  return {
    supplyKeys: clean.supplyKeys,
    cratesOpened: clean.cratesOpened,
    totalLevels: getTotalCollectionLevels(clean),
    selected: { ...clean.selected },
    canOpenCrate: clean.supplyKeys > 0,
    lastCrate: [...lastCrate],
    cards: COLLECTION_CARDS.map((definition) => {
      const data = clean.cards[definition.id] ?? { level: 0, progress: 0 };
      const nextLevelCopies = data.level >= COLLECTION_MAX_LEVEL
        ? null
        : data.level === 0
          ? 1
          : LEVEL_REQUIREMENTS[data.level + 1] - LEVEL_REQUIREMENTS[data.level];
      return {
        ...definition,
        level: data.level,
        maxLevel: COLLECTION_MAX_LEVEL,
        progress: data.progress,
        nextLevelCopies,
        owned: data.level > 0,
        selected: clean.selected[definition.category] === definition.id,
        bonusPercent: Math.round(definition.bonusPerLevel * data.level * 1000) / 10,
      };
    }),
  };
}
