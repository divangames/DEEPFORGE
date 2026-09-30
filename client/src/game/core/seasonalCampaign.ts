export type SeasonRewardKind = 'research' | 'recruit' | 'training' | 'promotion' | 'supply' | 'materials';
export type SeasonRewardTrack = 'free' | 'premium';

export interface SeasonReward {
  kind: SeasonRewardKind;
  amount?: number;
  alloy?: number;
  circuits?: number;
  fiber?: number;
  label: string;
}

export interface SeasonLevelDefinition {
  level: number;
  requiredXp: number;
  freeReward: SeasonReward;
  premiumReward: SeasonReward;
}

export interface SeasonalCampaignDefinition {
  seasonId: string;
  seasonIndex: number;
  title: string;
  subtitle: string;
  accent: string;
  startAt: number;
  endAt: number;
  levels: readonly SeasonLevelDefinition[];
}

export interface PersistentSeasonalCampaignState {
  seasonId: string;
  xp: number;
  premiumUnlocked: boolean;
  claimedFreeLevels: number[];
  claimedPremiumLevels: number[];
}

export interface SeasonLevelView extends SeasonLevelDefinition {
  reached: boolean;
  freeClaimed: boolean;
  premiumClaimed: boolean;
  canClaimFree: boolean;
  canClaimPremium: boolean;
}

export interface SeasonalCampaignView {
  seasonId: string;
  title: string;
  subtitle: string;
  accent: string;
  startAt: number;
  endAt: number;
  remainingSeconds: number;
  active: boolean;
  timeSource: 'server' | 'local';
  xp: number;
  currentLevel: number;
  maxLevel: number;
  nextLevel: number | null;
  nextLevelXp: number | null;
  levelProgress: number;
  premiumUnlocked: boolean;
  freeClaimedCount: number;
  premiumClaimedCount: number;
  levels: SeasonLevelView[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEASON_MS = 4 * WEEK_MS;
const MONDAY_EPOCH = Date.UTC(2024, 0, 1, 0, 0, 0, 0);
export const SEASON_LEVEL_COUNT = 20;

const THEMES = [
  { title: 'Forge Protocol', subtitle: 'Четыре недели промышленной экспансии.', accent: '#f0b55b' },
  { title: 'Cold Frontier', subtitle: 'Сезон ледяных контрактов и дальних объектов.', accent: '#8dd7ff' },
  { title: 'Redline Directive', subtitle: 'Высокотемпературный цикл добывающей сети.', accent: '#ff8064' },
  { title: 'Signal Horizon', subtitle: 'Сезон автоматизации и дальних логистических линий.', accent: '#7fe1c2' },
  { title: 'Void Industry', subtitle: 'Экспериментальная добыча за пределами стабильных зон.', accent: '#c993ff' },
  { title: 'Deep Current', subtitle: 'Океанические узлы и тяжёлая подводная логистика.', accent: '#62b6ff' },
] as const;

const FREE_REWARDS: readonly SeasonReward[] = [
  { kind: 'training', amount: 30, label: '▲ 30 Training Modules' },
  { kind: 'recruit', amount: 45, label: '⬢ 45 Recruit Data' },
  { kind: 'materials', alloy: 10, circuits: 6, fiber: 10, label: 'Craft Pack I' },
  { kind: 'supply', amount: 1, label: '▣ 1 Supply Key' },
  { kind: 'promotion', amount: 2, label: '● 2 Promotion Badges' },
  { kind: 'training', amount: 60, label: '▲ 60 Training Modules' },
  { kind: 'recruit', amount: 75, label: '⬢ 75 Recruit Data' },
  { kind: 'materials', alloy: 20, circuits: 14, fiber: 20, label: 'Craft Pack II' },
  { kind: 'supply', amount: 1, label: '▣ 1 Supply Key' },
  { kind: 'research', amount: 1, label: '◈ 1 Research Core' },
  { kind: 'training', amount: 100, label: '▲ 100 Training Modules' },
  { kind: 'recruit', amount: 110, label: '⬢ 110 Recruit Data' },
  { kind: 'materials', alloy: 34, circuits: 24, fiber: 34, label: 'Craft Pack III' },
  { kind: 'promotion', amount: 3, label: '● 3 Promotion Badges' },
  { kind: 'supply', amount: 2, label: '▣ 2 Supply Keys' },
  { kind: 'training', amount: 150, label: '▲ 150 Training Modules' },
  { kind: 'recruit', amount: 170, label: '⬢ 170 Recruit Data' },
  { kind: 'materials', alloy: 52, circuits: 38, fiber: 52, label: 'Advanced Craft Pack' },
  { kind: 'research', amount: 1, label: '◈ 1 Research Core' },
  { kind: 'research', amount: 2, label: '◈ 2 Research Cores' },
] as const;

const PREMIUM_REWARDS: readonly SeasonReward[] = [
  { kind: 'recruit', amount: 80, label: '⬢ 80 Recruit Data' },
  { kind: 'training', amount: 70, label: '▲ 70 Training Modules' },
  { kind: 'supply', amount: 1, label: '▣ 1 Supply Key' },
  { kind: 'materials', alloy: 24, circuits: 18, fiber: 24, label: 'Premium Craft Pack I' },
  { kind: 'promotion', amount: 3, label: '● 3 Promotion Badges' },
  { kind: 'recruit', amount: 130, label: '⬢ 130 Recruit Data' },
  { kind: 'training', amount: 130, label: '▲ 130 Training Modules' },
  { kind: 'supply', amount: 2, label: '▣ 2 Supply Keys' },
  { kind: 'materials', alloy: 40, circuits: 30, fiber: 40, label: 'Premium Craft Pack II' },
  { kind: 'research', amount: 2, label: '◈ 2 Research Cores' },
  { kind: 'promotion', amount: 4, label: '● 4 Promotion Badges' },
  { kind: 'recruit', amount: 220, label: '⬢ 220 Recruit Data' },
  { kind: 'supply', amount: 2, label: '▣ 2 Supply Keys' },
  { kind: 'training', amount: 240, label: '▲ 240 Training Modules' },
  { kind: 'research', amount: 2, label: '◈ 2 Research Cores' },
  { kind: 'materials', alloy: 76, circuits: 54, fiber: 76, label: 'Premium Craft Pack III' },
  { kind: 'promotion', amount: 5, label: '● 5 Promotion Badges' },
  { kind: 'supply', amount: 3, label: '▣ 3 Supply Keys' },
  { kind: 'research', amount: 3, label: '◈ 3 Research Cores' },
  { kind: 'research', amount: 4, label: '◈ 4 Research Cores' },
] as const;

export function getSeasonRequiredXp(level: number): number {
  const safe = Math.max(1, Math.min(SEASON_LEVEL_COUNT, Math.floor(level)));
  return safe * 100 + safe * safe * 10;
}

function buildSeasonLevels(): readonly SeasonLevelDefinition[] {
  return Array.from({ length: SEASON_LEVEL_COUNT }, (_, index) => {
    const level = index + 1;
    return {
      level,
      requiredXp: getSeasonRequiredXp(level),
      freeReward: FREE_REWARDS[index],
      premiumReward: PREMIUM_REWARDS[index],
    };
  });
}

const LEVELS = buildSeasonLevels();

function safeXp(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function sanitizeLevelList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Math.floor(Number(item))).filter((item) => Number.isFinite(item) && item >= 1 && item <= SEASON_LEVEL_COUNT))].sort((a, b) => a - b);
}

export function getSeasonalCampaignDefinition(now: number): SeasonalCampaignDefinition {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const seasonIndex = Math.floor((safeNow - MONDAY_EPOCH) / SEASON_MS);
  const startAt = MONDAY_EPOCH + seasonIndex * SEASON_MS;
  const endAt = startAt + SEASON_MS;
  const theme = THEMES[((seasonIndex % THEMES.length) + THEMES.length) % THEMES.length];
  const startDate = new Date(startAt);
  const year = startDate.getUTCFullYear();
  return {
    seasonId: `SC-${year}-${String(seasonIndex).padStart(3, '0')}`,
    seasonIndex,
    title: theme.title,
    subtitle: theme.subtitle,
    accent: theme.accent,
    startAt,
    endAt,
    levels: LEVELS,
  };
}

export function createSeasonalCampaignState(now: number): PersistentSeasonalCampaignState {
  const definition = getSeasonalCampaignDefinition(now);
  return {
    seasonId: definition.seasonId,
    xp: 0,
    premiumUnlocked: false,
    claimedFreeLevels: [],
    claimedPremiumLevels: [],
  };
}

export function sanitizeSeasonalCampaignState(value: Partial<PersistentSeasonalCampaignState> | null | undefined, now: number): PersistentSeasonalCampaignState {
  const definition = getSeasonalCampaignDefinition(now);
  if (!value || value.seasonId !== definition.seasonId) return createSeasonalCampaignState(now);
  return {
    seasonId: definition.seasonId,
    xp: safeXp(value.xp),
    premiumUnlocked: Boolean(value.premiumUnlocked),
    claimedFreeLevels: sanitizeLevelList(value.claimedFreeLevels),
    claimedPremiumLevels: sanitizeLevelList(value.claimedPremiumLevels),
  };
}

export function getSeasonLevelFromXp(xp: number): number {
  const safe = safeXp(xp);
  let level = 0;
  for (const item of LEVELS) {
    if (safe < item.requiredXp) break;
    level = item.level;
  }
  return level;
}

export function grantSeasonXp(state: PersistentSeasonalCampaignState, amount: number, now: number): PersistentSeasonalCampaignState {
  const current = sanitizeSeasonalCampaignState(state, now);
  return { ...current, xp: current.xp + Math.max(0, Math.floor(amount)) };
}

export function setSeasonPremiumUnlocked(state: PersistentSeasonalCampaignState, unlocked: boolean, now: number): PersistentSeasonalCampaignState {
  const current = sanitizeSeasonalCampaignState(state, now);
  return { ...current, premiumUnlocked: Boolean(unlocked) };
}

export function claimSeasonReward(
  state: PersistentSeasonalCampaignState,
  level: number,
  track: SeasonRewardTrack,
  now: number,
): { state: PersistentSeasonalCampaignState; reward: SeasonReward } | null {
  const current = sanitizeSeasonalCampaignState(state, now);
  const definition = LEVELS.find((item) => item.level === level);
  if (!definition || current.xp < definition.requiredXp) return null;
  if (track === 'premium' && !current.premiumUnlocked) return null;
  const claimed = track === 'free' ? current.claimedFreeLevels : current.claimedPremiumLevels;
  if (claimed.includes(level)) return null;
  const nextClaimed = [...claimed, level].sort((a, b) => a - b);
  return {
    state: track === 'free'
      ? { ...current, claimedFreeLevels: nextClaimed }
      : { ...current, claimedPremiumLevels: nextClaimed },
    reward: track === 'free' ? definition.freeReward : definition.premiumReward,
  };
}

export function buildSeasonalCampaignView(
  state: PersistentSeasonalCampaignState,
  now: number,
  timeSource: 'server' | 'local',
): SeasonalCampaignView {
  const definition = getSeasonalCampaignDefinition(now);
  const current = sanitizeSeasonalCampaignState(state, now);
  const currentLevel = getSeasonLevelFromXp(current.xp);
  const nextLevel = currentLevel < SEASON_LEVEL_COUNT ? currentLevel + 1 : null;
  const previousThreshold = currentLevel > 0 ? getSeasonRequiredXp(currentLevel) : 0;
  const nextThreshold = nextLevel ? getSeasonRequiredXp(nextLevel) : null;
  const levelProgress = nextThreshold === null
    ? 1
    : Math.max(0, Math.min(1, (current.xp - previousThreshold) / Math.max(1, nextThreshold - previousThreshold)));
  const freeClaimed = new Set(current.claimedFreeLevels);
  const premiumClaimed = new Set(current.claimedPremiumLevels);
  const levels = definition.levels.map((item) => {
    const reached = current.xp >= item.requiredXp;
    const freeWasClaimed = freeClaimed.has(item.level);
    const premiumWasClaimed = premiumClaimed.has(item.level);
    return {
      ...item,
      reached,
      freeClaimed: freeWasClaimed,
      premiumClaimed: premiumWasClaimed,
      canClaimFree: reached && !freeWasClaimed,
      canClaimPremium: reached && current.premiumUnlocked && !premiumWasClaimed,
    };
  });
  return {
    seasonId: definition.seasonId,
    title: definition.title,
    subtitle: definition.subtitle,
    accent: definition.accent,
    startAt: definition.startAt,
    endAt: definition.endAt,
    remainingSeconds: Math.max(0, (definition.endAt - now) / 1000),
    active: now >= definition.startAt && now < definition.endAt,
    timeSource,
    xp: current.xp,
    currentLevel,
    maxLevel: SEASON_LEVEL_COUNT,
    nextLevel,
    nextLevelXp: nextThreshold,
    levelProgress,
    premiumUnlocked: current.premiumUnlocked,
    freeClaimedCount: current.claimedFreeLevels.length,
    premiumClaimedCount: current.claimedPremiumLevels.length,
    levels,
  };
}
