export type CrewMissionRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CrewMissionReward {
  research: number;
  recruitData: number;
  trainingModules: number;
  promotionBadges: number;
  supplyKeys: number;
  alloy: number;
  circuits: number;
  fiber: number;
  label: string;
}

export interface CrewMissionDefinition {
  id: string;
  rarity: CrewMissionRarity;
  title: string;
  description: string;
  baseDurationSeconds: number;
  reward: CrewMissionReward;
}

export interface PersistentFriend {
  playerId: string;
  nickname: string;
  addedAt: number;
}

export interface PersistentActiveCrewMission {
  missionId: string;
  startedAt: number;
  endsAt: number;
  participantIds: string[];
}

export interface PersistentSocialState {
  playerId: string;
  nickname: string;
  friends: PersistentFriend[];
  missionRotation: number;
  activeMission: PersistentActiveCrewMission | null;
  completedMissions: number;
  lastCompleted: {
    title: string;
    rewardLabel: string;
    completedAt: number;
  } | null;
}

export interface SocialFriendView extends PersistentFriend {
  inActiveMission: boolean;
  canJoinMission: boolean;
}

export interface CrewMissionOfferView extends CrewMissionDefinition {
  durationLabel: string;
}

export interface ActiveCrewMissionView extends CrewMissionDefinition {
  startedAt: number;
  endsAt: number;
  remainingSeconds: number;
  progress: number;
  ready: boolean;
  participantIds: string[];
  participantCount: number;
  effectiveDurationSeconds: number;
}

export interface SocialView {
  playerId: string;
  nickname: string;
  friends: SocialFriendView[];
  friendCount: number;
  maxFriends: number;
  friendBonusPercent: number;
  friendBonusCapPercent: number;
  completedMissions: number;
  timeSource: 'server' | 'local';
  offers: CrewMissionOfferView[];
  activeMission: ActiveCrewMissionView | null;
  lastCompleted: PersistentSocialState['lastCompleted'];
}

export const MAX_FRIENDS = 20;
export const MAX_MISSION_FRIENDS = 3;
export const FRIEND_BONUS_PER_FRIEND = 0.02;
export const FRIEND_BONUS_CAP = 0.10;
const JOIN_REMAINING_REDUCTION = 0.15;

const MISSION_POOLS: Record<CrewMissionRarity, readonly CrewMissionDefinition[]> = {
  common: [
    {
      id: 'crew-salvage-relay',
      rarity: 'common',
      title: 'Salvage Relay',
      description: 'Соберите пригодные узлы на заброшенной линии и доставьте их в Forge Depot.',
      baseDurationSeconds: 6 * 60 * 60,
      reward: { research: 0, recruitData: 25, trainingModules: 30, promotionBadges: 0, supplyKeys: 0, alloy: 8, circuits: 0, fiber: 6, label: '⬢25 · ▲30 · Alloy 8 · Fiber 6' },
    },
    {
      id: 'crew-rail-inspection',
      rarity: 'common',
      title: 'Rail Inspection',
      description: 'Проверьте грузовую ветку и верните в строй повреждённые автоматические стрелки.',
      baseDurationSeconds: 6 * 60 * 60,
      reward: { research: 0, recruitData: 20, trainingModules: 36, promotionBadges: 0, supplyKeys: 0, alloy: 6, circuits: 4, fiber: 6, label: '⬢20 · ▲36 · Craft parts' },
    },
    {
      id: 'crew-dust-run',
      rarity: 'common',
      title: 'Dust Run',
      description: 'Короткий рейс за расходниками через внешнее кольцо Rust Valley.',
      baseDurationSeconds: 6 * 60 * 60,
      reward: { research: 0, recruitData: 30, trainingModules: 24, promotionBadges: 0, supplyKeys: 0, alloy: 5, circuits: 3, fiber: 10, label: '⬢30 · ▲24 · Fiber 10' },
    },
  ],
  rare: [
    {
      id: 'crew-frozen-convoy',
      rarity: 'rare',
      title: 'Frozen Convoy',
      description: 'Проведите грузовой конвой через нестабильный ледовый тоннель.',
      baseDurationSeconds: 12 * 60 * 60,
      reward: { research: 0, recruitData: 60, trainingModules: 55, promotionBadges: 0, supplyKeys: 1, alloy: 14, circuits: 8, fiber: 12, label: '⬢60 · ▲55 · ▣1 · Craft pack' },
    },
    {
      id: 'crew-reactor-parts',
      rarity: 'rare',
      title: 'Reactor Parts',
      description: 'Достаньте силовые модули из законсервированного энергоблока.',
      baseDurationSeconds: 12 * 60 * 60,
      reward: { research: 0, recruitData: 45, trainingModules: 70, promotionBadges: 1, supplyKeys: 0, alloy: 12, circuits: 16, fiber: 8, label: '⬢45 · ▲70 · ●1 · Circuits 16' },
    },
    {
      id: 'crew-signal-trace',
      rarity: 'rare',
      title: 'Signal Trace',
      description: 'Отследите старый навигационный маяк и заберите его память.',
      baseDurationSeconds: 12 * 60 * 60,
      reward: { research: 0, recruitData: 78, trainingModules: 48, promotionBadges: 0, supplyKeys: 1, alloy: 8, circuits: 14, fiber: 8, label: '⬢78 · ▲48 · ▣1' },
    },
  ],
  epic: [
    {
      id: 'crew-deep-recovery',
      rarity: 'epic',
      title: 'Deep Recovery',
      description: 'Спуститесь в аварийный ствол и поднимите экспериментальное оборудование.',
      baseDurationSeconds: 24 * 60 * 60,
      reward: { research: 1, recruitData: 110, trainingModules: 120, promotionBadges: 2, supplyKeys: 1, alloy: 26, circuits: 22, fiber: 24, label: '◈1 · ⬢110 · ▲120 · ●2' },
    },
    {
      id: 'crew-storm-cache',
      rarity: 'epic',
      title: 'Storm Cache',
      description: 'Заберите контейнеры из зоны электромагнитного шторма до нового импульса.',
      baseDurationSeconds: 24 * 60 * 60,
      reward: { research: 0, recruitData: 145, trainingModules: 105, promotionBadges: 2, supplyKeys: 2, alloy: 20, circuits: 30, fiber: 20, label: '⬢145 · ▲105 · ●2 · ▣2' },
    },
    {
      id: 'crew-lost-drill',
      rarity: 'epic',
      title: 'Lost Drill',
      description: 'Верните автономную буровую платформу, потерянную в глубинном разломе.',
      baseDurationSeconds: 24 * 60 * 60,
      reward: { research: 1, recruitData: 95, trainingModules: 135, promotionBadges: 1, supplyKeys: 2, alloy: 34, circuits: 18, fiber: 28, label: '◈1 · ▲135 · ▣2 · Craft pack' },
    },
  ],
  legendary: [
    {
      id: 'crew-blacksite-courier',
      rarity: 'legendary',
      title: 'Blacksite Courier',
      description: 'Доставьте закрытый груз через несколько секторов без остановки сети.',
      baseDurationSeconds: 48 * 60 * 60,
      reward: { research: 2, recruitData: 220, trainingModules: 240, promotionBadges: 4, supplyKeys: 3, alloy: 60, circuits: 48, fiber: 60, label: '◈2 · ⬢220 · ▲240 · ●4 · ▣3' },
    },
    {
      id: 'crew-void-probe',
      rarity: 'legendary',
      title: 'Void Probe',
      description: 'Сопроводите экспериментальный зонд к нестабильной глубинной аномалии.',
      baseDurationSeconds: 48 * 60 * 60,
      reward: { research: 3, recruitData: 180, trainingModules: 260, promotionBadges: 3, supplyKeys: 3, alloy: 52, circuits: 64, fiber: 46, label: '◈3 · ▲260 · ▣3 · Circuits 64' },
    },
    {
      id: 'crew-core-extraction',
      rarity: 'legendary',
      title: 'Core Extraction',
      description: 'Извлеките энергетическое ядро до обрушения старого комплекса.',
      baseDurationSeconds: 48 * 60 * 60,
      reward: { research: 2, recruitData: 260, trainingModules: 210, promotionBadges: 5, supplyKeys: 2, alloy: 72, circuits: 52, fiber: 58, label: '◈2 · ⬢260 · ●5 · Heavy craft pack' },
    },
  ],
};

const ALL_MISSIONS = Object.values(MISSION_POOLS).flat();
const MISSION_BY_ID = new Map(ALL_MISSIONS.map((mission) => [mission.id, mission]));

function randomSegment(length = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function createPlayerId(): string {
  return `DF-${randomSegment()}-${randomSegment()}`;
}

export function normalizePlayerId(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidPlayerId(value: string): boolean {
  return /^DF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(normalizePlayerId(value));
}

function defaultNickname(playerId: string): string {
  return `Operator ${playerId.slice(-4)}`;
}

export function createSocialState(now = Date.now(), playerId = createPlayerId()): PersistentSocialState {
  const normalized = isValidPlayerId(playerId) ? normalizePlayerId(playerId) : createPlayerId();
  return {
    playerId: normalized,
    nickname: defaultNickname(normalized),
    friends: [],
    missionRotation: 0,
    activeMission: null,
    completedMissions: 0,
    lastCompleted: null,
  };
}

function safeInt(value: unknown, fallback = 0): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function sanitizeFriend(value: Partial<PersistentFriend> | null | undefined): PersistentFriend | null {
  if (!value || !isValidPlayerId(value.playerId ?? '')) return null;
  const playerId = normalizePlayerId(value.playerId ?? '');
  return {
    playerId,
    nickname: String(value.nickname || defaultNickname(playerId)).slice(0, 28),
    addedAt: Math.max(0, Number(value.addedAt) || 0),
  };
}

export function sanitizeSocialState(value: Partial<PersistentSocialState> | null | undefined, now = Date.now()): PersistentSocialState {
  if (!value) return createSocialState(now);
  const playerId = isValidPlayerId(value.playerId ?? '') ? normalizePlayerId(value.playerId ?? '') : createPlayerId();
  const friends: PersistentFriend[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(value.friends) ? value.friends : []) {
    const friend = sanitizeFriend(raw);
    if (!friend || friend.playerId === playerId || seen.has(friend.playerId) || friends.length >= MAX_FRIENDS) continue;
    seen.add(friend.playerId);
    friends.push(friend);
  }

  let activeMission: PersistentActiveCrewMission | null = null;
  const rawActive = value.activeMission;
  if (rawActive && MISSION_BY_ID.has(rawActive.missionId ?? '')) {
    const participantIds = [...new Set((Array.isArray(rawActive.participantIds) ? rawActive.participantIds : [])
      .map((id) => normalizePlayerId(String(id)))
      .filter((id) => friends.some((friend) => friend.playerId === id)))].slice(0, MAX_MISSION_FRIENDS);
    activeMission = {
      missionId: String(rawActive.missionId),
      startedAt: Math.max(0, Number(rawActive.startedAt) || now),
      endsAt: Math.max(0, Number(rawActive.endsAt) || now),
      participantIds,
    };
  }

  return {
    playerId,
    nickname: String(value.nickname || defaultNickname(playerId)).slice(0, 28),
    friends,
    missionRotation: safeInt(value.missionRotation),
    activeMission,
    completedMissions: safeInt(value.completedMissions),
    lastCompleted: value.lastCompleted && typeof value.lastCompleted.title === 'string'
      ? {
          title: value.lastCompleted.title.slice(0, 60),
          rewardLabel: String(value.lastCompleted.rewardLabel ?? '').slice(0, 120),
          completedAt: Math.max(0, Number(value.lastCompleted.completedAt) || 0),
        }
      : null,
  };
}

export function addFriend(state: PersistentSocialState, rawPlayerId: string, now = Date.now()): PersistentSocialState | null {
  const current = sanitizeSocialState(state, now);
  const playerId = normalizePlayerId(rawPlayerId);
  if (!isValidPlayerId(playerId) || playerId === current.playerId || current.friends.length >= MAX_FRIENDS) return null;
  if (current.friends.some((friend) => friend.playerId === playerId)) return current;
  return {
    ...current,
    friends: [...current.friends, { playerId, nickname: defaultNickname(playerId), addedAt: now }],
  };
}

export function removeFriend(state: PersistentSocialState, playerId: string, now = Date.now()): PersistentSocialState {
  const current = sanitizeSocialState(state, now);
  const normalized = normalizePlayerId(playerId);
  return { ...current, friends: current.friends.filter((friend) => friend.playerId !== normalized) };
}

export function getFriendIncomeMultiplier(state: PersistentSocialState): number {
  const count = Math.max(0, Math.min(MAX_FRIENDS, Array.isArray(state.friends) ? state.friends.length : 0));
  return 1 + Math.min(FRIEND_BONUS_CAP, count * FRIEND_BONUS_PER_FRIEND);
}

function pick<T>(items: readonly T[], index: number): T {
  return items[((index % items.length) + items.length) % items.length];
}

export function getCrewMissionOffers(state: PersistentSocialState): readonly CrewMissionDefinition[] {
  const rotation = Math.max(0, Math.floor(state.missionRotation));
  const thirdRarity: CrewMissionRarity = rotation % 3 === 2 ? 'legendary' : 'epic';
  return [
    pick(MISSION_POOLS.common, rotation),
    pick(MISSION_POOLS.rare, rotation + 1),
    pick(MISSION_POOLS[thirdRarity], rotation + 2),
  ];
}

export function startCrewMission(state: PersistentSocialState, missionId: string, now: number): PersistentSocialState | null {
  const current = sanitizeSocialState(state, now);
  if (current.activeMission) return null;
  const mission = getCrewMissionOffers(current).find((item) => item.id === missionId);
  if (!mission) return null;
  return {
    ...current,
    activeMission: {
      missionId: mission.id,
      startedAt: now,
      endsAt: now + mission.baseDurationSeconds * 1000,
      participantIds: [],
    },
  };
}

export function joinCrewMission(state: PersistentSocialState, friendId: string, now: number): PersistentSocialState | null {
  const current = sanitizeSocialState(state, now);
  if (!current.activeMission) return null;
  const normalized = normalizePlayerId(friendId);
  if (!current.friends.some((friend) => friend.playerId === normalized)) return null;
  if (current.activeMission.participantIds.includes(normalized)) return current;
  if (current.activeMission.participantIds.length >= MAX_MISSION_FRIENDS) return null;
  const remainingMs = Math.max(0, current.activeMission.endsAt - now);
  return {
    ...current,
    activeMission: {
      ...current.activeMission,
      participantIds: [...current.activeMission.participantIds, normalized],
      endsAt: now + remainingMs * (1 - JOIN_REMAINING_REDUCTION),
    },
  };
}

export function claimCrewMission(
  state: PersistentSocialState,
  now: number,
): { state: PersistentSocialState; reward: CrewMissionReward; mission: CrewMissionDefinition } | null {
  const current = sanitizeSocialState(state, now);
  const active = current.activeMission;
  if (!active || now < active.endsAt) return null;
  const mission = MISSION_BY_ID.get(active.missionId);
  if (!mission) return null;
  return {
    mission,
    reward: mission.reward,
    state: {
      ...current,
      activeMission: null,
      completedMissions: current.completedMissions + 1,
      missionRotation: current.missionRotation + 1,
      lastCompleted: { title: mission.title, rewardLabel: mission.reward.label, completedAt: now },
    },
  };
}

export function formatCrewMissionDuration(seconds: number): string {
  const hours = Math.round(Math.max(0, seconds) / 3600);
  return `${hours}h`;
}

export function buildSocialView(state: PersistentSocialState, now: number, timeSource: 'server' | 'local'): SocialView {
  const current = sanitizeSocialState(state, now);
  const activeDefinition = current.activeMission ? MISSION_BY_ID.get(current.activeMission.missionId) ?? null : null;
  let activeMission: ActiveCrewMissionView | null = null;
  if (current.activeMission && activeDefinition) {
    const total = Math.max(1, current.activeMission.endsAt - current.activeMission.startedAt);
    const elapsed = Math.max(0, now - current.activeMission.startedAt);
    activeMission = {
      ...activeDefinition,
      startedAt: current.activeMission.startedAt,
      endsAt: current.activeMission.endsAt,
      remainingSeconds: Math.max(0, (current.activeMission.endsAt - now) / 1000),
      progress: Math.min(1, elapsed / total),
      ready: now >= current.activeMission.endsAt,
      participantIds: [...current.activeMission.participantIds],
      participantCount: current.activeMission.participantIds.length,
      effectiveDurationSeconds: total / 1000,
    };
  }

  const participantSet = new Set(current.activeMission?.participantIds ?? []);
  return {
    playerId: current.playerId,
    nickname: current.nickname,
    friends: current.friends.map((friend) => ({
      ...friend,
      inActiveMission: participantSet.has(friend.playerId),
      canJoinMission: Boolean(current.activeMission) && !participantSet.has(friend.playerId) && participantSet.size < MAX_MISSION_FRIENDS,
    })),
    friendCount: current.friends.length,
    maxFriends: MAX_FRIENDS,
    friendBonusPercent: Math.round((getFriendIncomeMultiplier(current) - 1) * 100),
    friendBonusCapPercent: Math.round(FRIEND_BONUS_CAP * 100),
    completedMissions: current.completedMissions,
    timeSource,
    offers: current.activeMission ? [] : getCrewMissionOffers(current).map((mission) => ({ ...mission, durationLabel: formatCrewMissionDuration(mission.baseDurationSeconds) })),
    activeMission,
    lastCompleted: current.lastCompleted,
  };
}
