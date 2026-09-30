export type ContractFacilityId = 'extraction' | 'lift' | 'logistics';
export type ContractRewardKind = 'research' | 'recruit' | 'training' | 'promotion' | 'supply' | 'materials';

export interface ContractReward {
  kind: ContractRewardKind;
  amount?: number;
  alloy?: number;
  circuits?: number;
  fiber?: number;
  label: string;
}

export interface ContractMilestoneDefinition {
  id: string;
  requiredCash: number;
  seasonXp: number;
  reward: ContractReward;
}

export interface WeeklyContractDefinition {
  eventId: string;
  weekIndex: number;
  title: string;
  subtitle: string;
  resourceName: string;
  currencyCode: string;
  accent: string;
  startAt: number;
  endAt: number;
  milestones: readonly ContractMilestoneDefinition[];
}

export interface PersistentWeeklyContractState {
  eventId: string;
  cash: number;
  totalCashEarned: number;
  extractionLevel: number;
  liftLevel: number;
  logisticsLevel: number;
  managers: Record<ContractFacilityId, boolean>;
  claimedMilestones: string[];
  lastSimulatedAt: number;
  manualShifts: number;
}

export interface WeeklyContractFacilityView {
  id: ContractFacilityId;
  name: string;
  level: number;
  rate: number;
  upgradeCost: number;
  managerHired: boolean;
  managerCost: number;
}

export interface WeeklyContractMilestoneView extends ContractMilestoneDefinition {
  claimed: boolean;
  ready: boolean;
  progress: number;
}

export interface WeeklyContractView {
  eventId: string;
  title: string;
  subtitle: string;
  resourceName: string;
  currencyCode: string;
  accent: string;
  startAt: number;
  endAt: number;
  remainingSeconds: number;
  active: boolean;
  timeSource: 'server' | 'local';
  cash: number;
  totalCashEarned: number;
  incomePerSecond: number;
  bottleneck: ContractFacilityId;
  managersHired: number;
  facilities: WeeklyContractFacilityView[];
  milestones: WeeklyContractMilestoneView[];
  claimedCount: number;
  manualShifts: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONDAY_EPOCH = Date.UTC(2024, 0, 1, 0, 0, 0, 0); // 2024-01-01 был понедельником.

const THEMES = [
  { title: 'Neon Foundry', subtitle: 'Ночной контракт на нестабильный неонит.', resourceName: 'Neonite', accent: '#5ce1e6' },
  { title: 'Arctic Relay', subtitle: 'Экспедиционная добыча в ледяном разломе.', resourceName: 'Cryolite', accent: '#8dd7ff' },
  { title: 'Ashfall Circuit', subtitle: 'Горячая зона: шлак, пепел и редкие сплавы.', resourceName: 'Ash Alloy', accent: '#ff916c' },
  { title: 'Jungle Salvage', subtitle: 'Затонувший промышленный узел под зеленью.', resourceName: 'Bioferrite', accent: '#7cde83' },
  { title: 'Lunar Works', subtitle: 'Короткая смена на лунном промышленном модуле.', resourceName: 'Helium Ore', accent: '#c5c9ff' },
  { title: 'Deep Sea Rig', subtitle: 'Добыча под давлением на океанической платформе.', resourceName: 'Abyss Shale', accent: '#62b6ff' },
  { title: 'Wasteland Refinery', subtitle: 'Контракт в старом нефтехимическом секторе.', resourceName: 'Blackglass', accent: '#e0b45c' },
  { title: 'Void Quarry', subtitle: 'Нестабильная зона с экстремальным коэффициентом риска.', resourceName: 'Voidstone', accent: '#c993ff' },
] as const;

export const WEEKLY_CONTRACT_MILESTONES: readonly ContractMilestoneDefinition[] = [
  { id: 'm1', requiredCash: 250, seasonXp: 100, reward: { kind: 'training', amount: 20, label: '▲ 20 Training Modules' } },
  { id: 'm2', requiredCash: 2_000, seasonXp: 120, reward: { kind: 'recruit', amount: 40, label: '⬢ 40 Recruit Data' } },
  { id: 'm3', requiredCash: 15_000, seasonXp: 150, reward: { kind: 'materials', alloy: 12, circuits: 8, fiber: 12, label: 'Craft Materials Pack' } },
  { id: 'm4', requiredCash: 100_000, seasonXp: 180, reward: { kind: 'supply', amount: 1, label: '▣ 1 Supply Key' } },
  { id: 'm5', requiredCash: 750_000, seasonXp: 220, reward: { kind: 'promotion', amount: 2, label: '● 2 Promotion Badges' } },
  { id: 'm6', requiredCash: 5_000_000, seasonXp: 280, reward: { kind: 'research', amount: 1, label: '◈ 1 Research Core' } },
  { id: 'm7', requiredCash: 35_000_000, seasonXp: 360, reward: { kind: 'materials', alloy: 40, circuits: 32, fiber: 40, label: 'Advanced Craft Pack' } },
  { id: 'm8', requiredCash: 250_000_000, seasonXp: 500, reward: { kind: 'research', amount: 2, label: '◈ 2 Research Cores' } },
] as const;

function safeInt(value: unknown, fallback: number, min = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

function safeNumber(value: unknown, fallback: number, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}

export function getWeeklyContractDefinition(now: number): WeeklyContractDefinition {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const weekIndex = Math.floor((safeNow - MONDAY_EPOCH) / WEEK_MS);
  const startAt = MONDAY_EPOCH + weekIndex * WEEK_MS;
  const endAt = startAt + WEEK_MS;
  const theme = THEMES[((weekIndex % THEMES.length) + THEMES.length) % THEMES.length];
  const d = new Date(startAt);
  const year = d.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const weekOfYear = Math.max(1, Math.ceil((startAt - jan1 + 1) / WEEK_MS));
  return {
    eventId: `WC-${year}-${String(weekOfYear).padStart(2, '0')}-${weekIndex}`,
    weekIndex,
    title: theme.title,
    subtitle: theme.subtitle,
    resourceName: theme.resourceName,
    currencyCode: 'CT',
    accent: theme.accent,
    startAt,
    endAt,
    milestones: WEEKLY_CONTRACT_MILESTONES,
  };
}

export function createWeeklyContractState(now: number): PersistentWeeklyContractState {
  const definition = getWeeklyContractDefinition(now);
  return {
    eventId: definition.eventId,
    cash: 60,
    totalCashEarned: 0,
    extractionLevel: 1,
    liftLevel: 1,
    logisticsLevel: 1,
    managers: { extraction: false, lift: false, logistics: false },
    claimedMilestones: [],
    lastSimulatedAt: now,
    manualShifts: 0,
  };
}

export function sanitizeWeeklyContractState(value: Partial<PersistentWeeklyContractState> | null | undefined, now: number): PersistentWeeklyContractState {
  const definition = getWeeklyContractDefinition(now);
  if (!value || value.eventId !== definition.eventId) return createWeeklyContractState(now);
  const claimed = new Set(WEEKLY_CONTRACT_MILESTONES.map((item) => item.id));
  return {
    eventId: definition.eventId,
    cash: safeNumber(value.cash, 60),
    totalCashEarned: safeNumber(value.totalCashEarned, 0),
    extractionLevel: safeInt(value.extractionLevel, 1, 1),
    liftLevel: safeInt(value.liftLevel, 1, 1),
    logisticsLevel: safeInt(value.logisticsLevel, 1, 1),
    managers: {
      extraction: Boolean(value.managers?.extraction),
      lift: Boolean(value.managers?.lift),
      logistics: Boolean(value.managers?.logistics),
    },
    claimedMilestones: Array.isArray(value.claimedMilestones) ? value.claimedMilestones.filter((id) => claimed.has(id)) : [],
    lastSimulatedAt: Math.min(now, safeNumber(value.lastSimulatedAt, now)),
    manualShifts: safeInt(value.manualShifts, 0),
  };
}

export function getContractRate(id: ContractFacilityId, level: number): number {
  const lv = Math.max(1, level);
  const bases: Record<ContractFacilityId, number> = { extraction: 5.4, lift: 5.0, logistics: 4.7 };
  const growth: Record<ContractFacilityId, number> = { extraction: 1.12, lift: 1.115, logistics: 1.11 };
  return bases[id] * Math.pow(growth[id], lv - 1);
}

export function getContractUpgradeCost(id: ContractFacilityId, level: number): number {
  const bases: Record<ContractFacilityId, number> = { extraction: 45, lift: 52, logistics: 58 };
  const growth: Record<ContractFacilityId, number> = { extraction: 1.18, lift: 1.19, logistics: 1.20 };
  return Math.floor(bases[id] * Math.pow(growth[id], Math.max(0, level - 1)));
}

export function getContractManagerCost(id: ContractFacilityId): number {
  return id === 'extraction' ? 110 : id === 'lift' ? 180 : 260;
}

export function getContractIncomePerSecond(state: PersistentWeeklyContractState): { income: number; bottleneck: ContractFacilityId } {
  const extraction = getContractRate('extraction', state.extractionLevel);
  const lift = getContractRate('lift', state.liftLevel);
  const logistics = getContractRate('logistics', state.logisticsLevel);
  const min = Math.min(extraction, lift, logistics);
  const bottleneck: ContractFacilityId = min === extraction ? 'extraction' : min === lift ? 'lift' : 'logistics';
  const fullyAutomated = state.managers.extraction && state.managers.lift && state.managers.logistics;
  return { income: fullyAutomated ? min * 2.4 : 0, bottleneck };
}

export function advanceWeeklyContract(state: PersistentWeeklyContractState, now: number): PersistentWeeklyContractState {
  const current = sanitizeWeeklyContractState(state, now);
  const definition = getWeeklyContractDefinition(now);
  if (current.eventId !== definition.eventId) return createWeeklyContractState(now);
  const elapsed = Math.max(0, Math.min(4 * 60 * 60, (now - current.lastSimulatedAt) / 1000));
  const { income } = getContractIncomePerSecond(current);
  const earned = income * elapsed;
  return {
    ...current,
    cash: current.cash + earned,
    totalCashEarned: current.totalCashEarned + earned,
    lastSimulatedAt: now,
  };
}

export function upgradeWeeklyContractFacility(state: PersistentWeeklyContractState, id: ContractFacilityId): PersistentWeeklyContractState | null {
  const levelKey = `${id}Level` as 'extractionLevel' | 'liftLevel' | 'logisticsLevel';
  const cost = getContractUpgradeCost(id, state[levelKey]);
  if (state.cash < cost) return null;
  return { ...state, cash: state.cash - cost, [levelKey]: state[levelKey] + 1 };
}

export function hireWeeklyContractManager(state: PersistentWeeklyContractState, id: ContractFacilityId): PersistentWeeklyContractState | null {
  if (state.managers[id]) return state;
  const cost = getContractManagerCost(id);
  if (state.cash < cost) return null;
  return { ...state, cash: state.cash - cost, managers: { ...state.managers, [id]: true } };
}

export function runWeeklyContractManualShift(state: PersistentWeeklyContractState): PersistentWeeklyContractState {
  const extraction = getContractRate('extraction', state.extractionLevel);
  const lift = getContractRate('lift', state.liftLevel);
  const logistics = getContractRate('logistics', state.logisticsLevel);
  const reward = Math.max(6, Math.min(extraction, lift, logistics) * 2.4 * 4);
  return {
    ...state,
    cash: state.cash + reward,
    totalCashEarned: state.totalCashEarned + reward,
    manualShifts: state.manualShifts + 1,
  };
}

export function claimWeeklyContractMilestone(state: PersistentWeeklyContractState, milestoneId: string): { state: PersistentWeeklyContractState; reward: ContractReward } | null {
  const milestone = WEEKLY_CONTRACT_MILESTONES.find((item) => item.id === milestoneId);
  if (!milestone || state.claimedMilestones.includes(milestoneId) || state.totalCashEarned < milestone.requiredCash) return null;
  return {
    state: { ...state, claimedMilestones: [...state.claimedMilestones, milestoneId] },
    reward: milestone.reward,
  };
}

export function buildWeeklyContractView(state: PersistentWeeklyContractState, now: number, timeSource: 'server' | 'local'): WeeklyContractView {
  const definition = getWeeklyContractDefinition(now);
  const safe = sanitizeWeeklyContractState(state, now);
  const rates: Record<ContractFacilityId, number> = {
    extraction: getContractRate('extraction', safe.extractionLevel),
    lift: getContractRate('lift', safe.liftLevel),
    logistics: getContractRate('logistics', safe.logisticsLevel),
  };
  const { income, bottleneck } = getContractIncomePerSecond(safe);
  const facilities: WeeklyContractFacilityView[] = (['extraction', 'lift', 'logistics'] as const).map((id) => {
    const level = id === 'extraction' ? safe.extractionLevel : id === 'lift' ? safe.liftLevel : safe.logisticsLevel;
    return {
      id,
      name: id === 'extraction' ? 'Extraction Crew' : id === 'lift' ? 'Cargo Lift' : 'Logistics Hub',
      level,
      rate: rates[id],
      upgradeCost: getContractUpgradeCost(id, level),
      managerHired: safe.managers[id],
      managerCost: getContractManagerCost(id),
    };
  });
  const milestones = definition.milestones.map((milestone) => ({
    ...milestone,
    claimed: safe.claimedMilestones.includes(milestone.id),
    ready: safe.totalCashEarned >= milestone.requiredCash && !safe.claimedMilestones.includes(milestone.id),
    progress: Math.min(1, safe.totalCashEarned / Math.max(1, milestone.requiredCash)),
  }));
  return {
    eventId: definition.eventId,
    title: definition.title,
    subtitle: definition.subtitle,
    resourceName: definition.resourceName,
    currencyCode: definition.currencyCode,
    accent: definition.accent,
    startAt: definition.startAt,
    endAt: definition.endAt,
    remainingSeconds: Math.max(0, (definition.endAt - now) / 1000),
    active: now >= definition.startAt && now < definition.endAt,
    timeSource,
    cash: safe.cash,
    totalCashEarned: safe.totalCashEarned,
    incomePerSecond: income,
    bottleneck,
    managersHired: Object.values(safe.managers).filter(Boolean).length,
    facilities,
    milestones,
    claimedCount: safe.claimedMilestones.length,
    manualShifts: safe.manualShifts,
  };
}
