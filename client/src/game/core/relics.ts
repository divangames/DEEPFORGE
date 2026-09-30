export type RelicId = 'first-spark' | 'five-sites' | 'crew-bond' | 'academy-seal' | 'collector-sigil' | 'forge-emblem';

export interface PersistentRelicState {
  unlocked: RelicId[];
}

export interface RelicContext {
  totalRebuilds: number;
  unlockedMines: number;
  recruitedSpecialists: number;
  academyCompleted: number;
  collectionLevels: number;
  craftedEquipment: number;
}

export interface RelicDefinition {
  id: RelicId;
  name: string;
  description: string;
  requirement: string;
  shaftYieldMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
  incomeMultiplier: number;
  isUnlocked: (context: RelicContext) => boolean;
}

export interface RelicModifiers {
  shaftYieldMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
  incomeMultiplier: number;
}

export interface RelicViewItem extends Omit<RelicDefinition, 'isUnlocked'> {
  unlocked: boolean;
}

export interface RelicView {
  unlockedCount: number;
  total: number;
  items: RelicViewItem[];
}

export const RELICS: readonly RelicDefinition[] = [
  {
    id: 'first-spark', name: 'First Spark', description: '+3% ко всей стоимости ресурса.', requirement: 'Сделать 1 Rebuild',
    shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1, incomeMultiplier: 1.03,
    isUnlocked: (c) => c.totalRebuilds >= 1,
  },
  {
    id: 'five-sites', name: 'Five Sites', description: '+4% ко всей стоимости ресурса.', requirement: 'Открыть 5 шахт',
    shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1, incomeMultiplier: 1.04,
    isUnlocked: (c) => c.unlockedMines >= 5,
  },
  {
    id: 'crew-bond', name: 'Crew Bond', description: '+5% добычи всех Deck.', requirement: 'Нанять 3 Specialists',
    shaftYieldMultiplier: 1.05, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1, incomeMultiplier: 1,
    isUnlocked: (c) => c.recruitedSpecialists >= 3,
  },
  {
    id: 'academy-seal', name: 'Academy Seal', description: '+5% Cargo Lift.', requirement: 'Пройти 10 Academy Operations',
    shaftYieldMultiplier: 1, liftCapacityMultiplier: 1.05, hubCapacityMultiplier: 1, incomeMultiplier: 1,
    isUnlocked: (c) => c.academyCompleted >= 10,
  },
  {
    id: 'collector-sigil', name: 'Collector Sigil', description: '+5% Logistics.', requirement: 'Набрать 9 уровней Collection',
    shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1.05, incomeMultiplier: 1,
    isUnlocked: (c) => c.collectionLevels >= 9,
  },
  {
    id: 'forge-emblem', name: 'Forge Emblem', description: '+6% ко всей стоимости ресурса.', requirement: 'Скрафтить 5 предметов Equipment',
    shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1, incomeMultiplier: 1.06,
    isUnlocked: (c) => c.craftedEquipment >= 5,
  },
] as const;

const RELIC_IDS = new Set(RELICS.map((item) => item.id));
export const DEFAULT_RELIC_STATE: PersistentRelicState = { unlocked: [] };

export function sanitizeRelicState(value?: Partial<PersistentRelicState> | null): PersistentRelicState {
  return {
    unlocked: [...new Set((value?.unlocked ?? []).filter((id): id is RelicId => RELIC_IDS.has(id as RelicId)))],
  };
}

export function evaluateRelics(state: PersistentRelicState, context: RelicContext): PersistentRelicState {
  const next = sanitizeRelicState(state);
  const unlocked = new Set(next.unlocked);
  for (const relic of RELICS) if (relic.isUnlocked(context)) unlocked.add(relic.id);
  next.unlocked = [...unlocked];
  return next;
}

export function getRelicModifiers(state: PersistentRelicState): RelicModifiers {
  const unlocked = new Set(state.unlocked);
  return RELICS.reduce<RelicModifiers>((result, relic) => {
    if (!unlocked.has(relic.id)) return result;
    result.shaftYieldMultiplier *= relic.shaftYieldMultiplier;
    result.liftCapacityMultiplier *= relic.liftCapacityMultiplier;
    result.hubCapacityMultiplier *= relic.hubCapacityMultiplier;
    result.incomeMultiplier *= relic.incomeMultiplier;
    return result;
  }, { shaftYieldMultiplier: 1, liftCapacityMultiplier: 1, hubCapacityMultiplier: 1, incomeMultiplier: 1 });
}

export function buildRelicView(state: PersistentRelicState): RelicView {
  const clean = sanitizeRelicState(state);
  const unlocked = new Set(clean.unlocked);
  return {
    unlockedCount: clean.unlocked.length,
    total: RELICS.length,
    items: RELICS.map(({ isUnlocked: _isUnlocked, ...item }) => ({ ...item, unlocked: unlocked.has(item.id) })),
  };
}
