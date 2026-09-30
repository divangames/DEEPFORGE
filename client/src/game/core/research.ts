export type ResearchBranchId = 'industry' | 'logistics' | 'automation' | 'exploration' | 'specialists' | 'events';

export type ResearchEffectKey =
  | 'shaftYieldMultiplier'
  | 'liftCapacityMultiplier'
  | 'hubCapacityMultiplier'
  | 'incomeMultiplier'
  | 'upgradeCostMultiplier'
  | 'managerPassiveMultiplier'
  | 'managerCooldownMultiplier'
  | 'barrierDurationMultiplier'
  | 'offlineIncomeMultiplier'
  | 'offlineCapMultiplier'
  | 'unlockCostMultiplier'
  | 'specialistPassiveMultiplier'
  | 'specialistCooldownMultiplier';

export interface ResearchNodeDefinition {
  id: string;
  branch: ResearchBranchId;
  tier: number;
  title: string;
  description: string;
  cost: number;
  requires: readonly string[];
  effects: Partial<Record<ResearchEffectKey, number>>;
}

export interface ResearchBranchDefinition {
  id: ResearchBranchId;
  name: string;
  shortName: string;
  description: string;
  accent: string;
}

export interface ResearchModifiers {
  shaftYieldMultiplier: number;
  liftCapacityMultiplier: number;
  hubCapacityMultiplier: number;
  incomeMultiplier: number;
  upgradeCostMultiplier: number;
  managerPassiveMultiplier: number;
  managerCooldownMultiplier: number;
  barrierDurationMultiplier: number;
  offlineIncomeMultiplier: number;
  offlineCapMultiplier: number;
  unlockCostMultiplier: number;
  specialistPassiveMultiplier: number;
  specialistCooldownMultiplier: number;
}

export interface PersistentResearchState {
  cores: number;
  purchased: string[];
  respecCount: number;
}

export const DEFAULT_RESEARCH_STATE: PersistentResearchState = {
  cores: 3,
  purchased: [],
  respecCount: 0,
};

export const RESEARCH_BRANCHES: readonly ResearchBranchDefinition[] = [
  { id: 'industry', name: 'Industry', shortName: 'IND', description: 'Добыча, цена сырья и стоимость улучшений.', accent: '#f0b429' },
  { id: 'logistics', name: 'Logistics', shortName: 'LOG', description: 'Cargo Lift и наземная логистика.', accent: '#55c4e8' },
  { id: 'automation', name: 'Automation', shortName: 'AUT', description: 'Менеджеры, их пассивные бонусы и cooldown.', accent: '#74d99f' },
  { id: 'exploration', name: 'Exploration', shortName: 'EXP', description: 'Барьеры, открытие Deck и автономная работа.', accent: '#d19cff' },
  { id: 'specialists', name: 'Specialists', shortName: 'SPC', description: 'Подготовка глобальных бонусов будущей Specialist-системы.', accent: '#ff8f76' },
  { id: 'events', name: 'Events', shortName: 'EVT', description: 'Задел для будущих контрактов и временных режимов.', accent: '#e9d86f' },
] as const;

export const RESEARCH_NODES: readonly ResearchNodeDefinition[] = [
  { id: 'ind-1', branch: 'industry', tier: 1, title: 'Hardened Tools', description: '+10% добычи всех Deck.', cost: 1, requires: [], effects: { shaftYieldMultiplier: 1.10 } },
  { id: 'ind-2', branch: 'industry', tier: 2, title: 'Ore Grading', description: '+12% стоимости продаваемого сырья.', cost: 2, requires: ['ind-1'], effects: { incomeMultiplier: 1.12 } },
  { id: 'ind-3', branch: 'industry', tier: 3, title: 'Bulk Procurement', description: '-8% стоимости всех улучшений.', cost: 3, requires: ['ind-2'], effects: { upgradeCostMultiplier: 0.92 } },

  { id: 'log-1', branch: 'logistics', tier: 1, title: 'Reinforced Cables', description: '+12% вместимости Cargo Lift.', cost: 1, requires: [], effects: { liftCapacityMultiplier: 1.12 } },
  { id: 'log-2', branch: 'logistics', tier: 2, title: 'Cargo Routing', description: '+12% пропускной способности Logistics.', cost: 2, requires: ['log-1'], effects: { hubCapacityMultiplier: 1.12 } },
  { id: 'log-3', branch: 'logistics', tier: 3, title: 'Unified Freight', description: '+10% Lift и Logistics одновременно.', cost: 3, requires: ['log-2'], effects: { liftCapacityMultiplier: 1.10, hubCapacityMultiplier: 1.10 } },

  { id: 'aut-1', branch: 'automation', tier: 1, title: 'Supervisor Training', description: '+8% к пассивным бонусам менеджеров.', cost: 1, requires: [], effects: { managerPassiveMultiplier: 1.08 } },
  { id: 'aut-2', branch: 'automation', tier: 2, title: 'Rapid Briefing', description: '-10% cooldown активных способностей.', cost: 2, requires: ['aut-1'], effects: { managerCooldownMultiplier: 0.90 } },
  { id: 'aut-3', branch: 'automation', tier: 3, title: 'Autonomous Doctrine', description: 'Ещё +12% к пассивным бонусам менеджеров.', cost: 3, requires: ['aut-2'], effects: { managerPassiveMultiplier: 1.12 } },

  { id: 'exp-1', branch: 'exploration', tier: 1, title: 'Survey Charges', description: '-15% времени расчистки барьеров.', cost: 1, requires: [], effects: { barrierDurationMultiplier: 0.85 } },
  { id: 'exp-2', branch: 'exploration', tier: 2, title: 'Remote Survey', description: '-10% стоимости открытия новых Deck.', cost: 2, requires: ['exp-1'], effects: { unlockCostMultiplier: 0.90 } },
  { id: 'exp-3', branch: 'exploration', tier: 3, title: 'Deep Shift', description: '+25% к лимиту автономной работы.', cost: 3, requires: ['exp-2'], effects: { offlineCapMultiplier: 1.25 } },

  { id: 'spc-1', branch: 'specialists', tier: 1, title: 'Field Doctrine', description: '+10% к пассивным бонусам Specialists.', cost: 1, requires: [], effects: { specialistPassiveMultiplier: 1.10 } },
  { id: 'spc-2', branch: 'specialists', tier: 2, title: 'Cross Training', description: '-10% cooldown способностей Specialists.', cost: 2, requires: ['spc-1'], effects: { specialistCooldownMultiplier: 0.90 } },
  { id: 'spc-3', branch: 'specialists', tier: 3, title: 'Elite Rotation', description: 'Ещё +18% к пассивным бонусам Specialists.', cost: 4, requires: ['spc-2'], effects: { specialistPassiveMultiplier: 1.18 } },

  { id: 'evt-1', branch: 'events', tier: 1, title: 'Reserve Shifts', description: '+10% автономного дохода.', cost: 1, requires: [], effects: { offlineIncomeMultiplier: 1.10 } },
  { id: 'evt-2', branch: 'events', tier: 2, title: 'Contract Supply', description: '-5% стоимости улучшений.', cost: 2, requires: ['evt-1'], effects: { upgradeCostMultiplier: 0.95 } },
  { id: 'evt-3', branch: 'events', tier: 3, title: 'Campaign Logistics', description: '+10% общего дохода и +10% offline cap.', cost: 4, requires: ['evt-2'], effects: { incomeMultiplier: 1.10, offlineCapMultiplier: 1.10 } },
] as const;

const NODE_MAP = new Map(RESEARCH_NODES.map((node) => [node.id, node]));

export function sanitizeResearchState(value?: Partial<PersistentResearchState> | null): PersistentResearchState {
  const purchased = Array.from(new Set((value?.purchased ?? []).filter((id) => NODE_MAP.has(id))));
  return {
    cores: Math.max(0, Math.floor(Number(value?.cores) || 0)),
    purchased,
    respecCount: Math.max(0, Math.floor(Number(value?.respecCount) || 0)),
  };
}

export function getResearchModifiers(purchased: readonly string[]): ResearchModifiers {
  const modifiers: ResearchModifiers = {
    shaftYieldMultiplier: 1,
    liftCapacityMultiplier: 1,
    hubCapacityMultiplier: 1,
    incomeMultiplier: 1,
    upgradeCostMultiplier: 1,
    managerPassiveMultiplier: 1,
    managerCooldownMultiplier: 1,
    barrierDurationMultiplier: 1,
    offlineIncomeMultiplier: 1,
    offlineCapMultiplier: 1,
    unlockCostMultiplier: 1,
    specialistPassiveMultiplier: 1,
    specialistCooldownMultiplier: 1,
  };

  for (const id of purchased) {
    const node = NODE_MAP.get(id);
    if (!node) continue;
    for (const [key, value] of Object.entries(node.effects) as [ResearchEffectKey, number][]) {
      modifiers[key] *= value;
    }
  }
  return modifiers;
}

export function canPurchaseResearchNode(nodeId: string, state: PersistentResearchState): boolean {
  const node = NODE_MAP.get(nodeId);
  if (!node || state.purchased.includes(nodeId) || state.cores < node.cost) return false;
  return node.requires.every((id) => state.purchased.includes(id));
}

export function purchaseResearchNode(nodeId: string, state: PersistentResearchState): PersistentResearchState | null {
  const node = NODE_MAP.get(nodeId);
  if (!node || !canPurchaseResearchNode(nodeId, state)) return null;
  return {
    ...state,
    cores: state.cores - node.cost,
    purchased: [...state.purchased, node.id],
  };
}

export function getResearchSpentCores(purchased: readonly string[]): number {
  return purchased.reduce((sum, id) => sum + (NODE_MAP.get(id)?.cost ?? 0), 0);
}

export function getResearchRespecQuote(state: PersistentResearchState): { spent: number; fee: number; refund: number } {
  const spent = getResearchSpentCores(state.purchased);
  if (spent <= 0) return { spent: 0, fee: 0, refund: 0 };
  const fee = Math.min(spent, Math.max(1, Math.ceil(spent * 0.15)));
  return { spent, fee, refund: Math.max(0, spent - fee) };
}

export function respecResearch(state: PersistentResearchState): PersistentResearchState | null {
  if (state.purchased.length === 0) return null;
  const quote = getResearchRespecQuote(state);
  return {
    cores: state.cores + quote.refund,
    purchased: [],
    respecCount: state.respecCount + 1,
  };
}

export function getRebuildResearchReward(newRebuildLevel: number): number {
  return Math.max(1, 2 + Math.floor(newRebuildLevel / 2));
}

export function getResearchNode(id: string): ResearchNodeDefinition | undefined {
  return NODE_MAP.get(id);
}
