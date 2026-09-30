import { APP_CONFIG } from '../config/appConfig';
import { DEFAULT_RESEARCH_STATE, sanitizeResearchState } from '../game/core/research';
import { DEFAULT_ACADEMY_STATE, grantAcademyMigrationResources, sanitizeAcademyState } from '../game/core/academy';
import { DEFAULT_SPECIALIST_SYSTEM, migrateStageNineSpecialists, sanitizeSpecialistSystem } from '../game/core/specialists';
import { DEFAULT_EQUIPMENT_STATE, sanitizeEquipmentState } from '../game/core/equipment';
import { DEFAULT_COLLECTION_STATE, sanitizeCollectionState } from '../game/core/collection';
import { DEFAULT_RELIC_STATE, sanitizeRelicState } from '../game/core/relics';
import { WEEKLY_CONTRACT_MILESTONES, createWeeklyContractState, sanitizeWeeklyContractState } from '../game/core/weeklyContract';
import { createSeasonalCampaignState, grantSeasonXp, sanitizeSeasonalCampaignState } from '../game/core/seasonalCampaign';
import { createSocialState, sanitizeSocialState } from '../game/core/social';
import type { MineId, PersistentMineState, PersistentWorldState, SectorId } from '../game/core/types';
import { DEFAULT_MINE_ID, DEFAULT_SECTOR_ID, getMineDefinition, WORLD_MINES } from '../game/core/worldConfig';
import type { SaveRecord } from './gameDb';

export interface DeepforgeSave {
  createdAt: number;
  lastSeenAt: number;
  settings: {
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  world: PersistentWorldState;
}

interface LegacySave {
  createdAt: number;
  lastSeenAt: number;
  settings: DeepforgeSave['settings'];
  mine: PersistentMineState;
}

interface StageFiveSave {
  createdAt: number;
  lastSeenAt: number;
  settings: DeepforgeSave['settings'];
  world: {
    activeMineId: MineId;
    unlockedMines: MineId[];
    mines: Partial<Record<MineId, PersistentMineState>>;
    lastSimulatedAt: Partial<Record<MineId, number>>;
  };
}

function isSettings(value: unknown): value is DeepforgeSave['settings'] {
  if (!value || typeof value !== 'object') return false;
  const quality = (value as { quality?: unknown }).quality;
  return quality === 'LOW' || quality === 'MEDIUM' || quality === 'HIGH';
}

function stripMineCash(state: PersistentMineState): PersistentMineState {
  return { ...state, cash: 0 };
}

function inferUnlockedSectors(unlockedMines: MineId[]): SectorId[] {
  const result = new Set<SectorId>([DEFAULT_SECTOR_ID]);
  for (const id of unlockedMines) result.add(getMineDefinition(id).sectorId);
  return [...result];
}

function parseStageThirteen(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== APP_CONFIG.saveSchemaVersion) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const unlockedMines = payload.world.unlockedMines;
  payload.world.unlockedSectors ??= inferUnlockedSectors(unlockedMines);
  payload.world.sectorWallets ??= {};
  payload.world.research = sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE);
  payload.world.specialists = sanitizeSpecialistSystem(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM);
  payload.world.academy = sanitizeAcademyState(payload.world.academy ?? DEFAULT_ACADEMY_STATE);
  payload.world.equipment = sanitizeEquipmentState(payload.world.equipment ?? DEFAULT_EQUIPMENT_STATE);
  payload.world.collection = sanitizeCollectionState(payload.world.collection ?? DEFAULT_COLLECTION_STATE);
  payload.world.relics = sanitizeRelicState(payload.world.relics ?? DEFAULT_RELIC_STATE);
  payload.world.weeklyContract = sanitizeWeeklyContractState(payload.world.weeklyContract, payload.lastSeenAt);
  payload.world.seasonalCampaign = sanitizeSeasonalCampaignState(payload.world.seasonalCampaign, payload.lastSeenAt);
  payload.world.social = sanitizeSocialState(payload.world.social, payload.lastSeenAt);
  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  for (const [id, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state) continue;
    mines[id] = {
      ...state,
      rebuildLevel: Math.max(0, Math.floor(state.rebuildLevel ?? 0)),
      rebuildCycleCashEarned: Math.max(0, state.rebuildCycleCashEarned ?? state.totalCashEarned ?? 0),
    };
  }
  payload.world.mines = mines;
  return payload as DeepforgeSave;
}


function migrateStageThirteen(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 11) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  for (const [id, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state) continue;
    mines[id] = {
      ...state,
      rebuildLevel: Math.max(0, Math.floor(state.rebuildLevel ?? 0)),
      rebuildCycleCashEarned: Math.max(0, state.rebuildCycleCashEarned ?? state.totalCashEarned ?? 0),
    };
  }

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists: sanitizeSpecialistSystem(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(payload.world.academy ?? DEFAULT_ACADEMY_STATE),
      equipment: sanitizeEquipmentState(payload.world.equipment ?? DEFAULT_EQUIPMENT_STATE),
      collection: sanitizeCollectionState(payload.world.collection ?? DEFAULT_COLLECTION_STATE),
      relics: sanitizeRelicState(payload.world.relics ?? DEFAULT_RELIC_STATE),
      weeklyContract: sanitizeWeeklyContractState(payload.world.weeklyContract, payload.lastSeenAt),
      seasonalCampaign: sanitizeSeasonalCampaignState(payload.world.seasonalCampaign, payload.lastSeenAt),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines,
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}


function migrateStageTwelve(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 10) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const weeklyContract = sanitizeWeeklyContractState(payload.world.weeklyContract, payload.lastSeenAt);
  let seasonalCampaign = createSeasonalCampaignState(payload.lastSeenAt);
  // Компенсируем XP за milestone текущего недельного контракта, уже забранные в Stage 12.
  const claimed = new Set(weeklyContract.claimedMilestones);
  const migrationXp = WEEKLY_CONTRACT_MILESTONES.reduce((sum, item) => sum + (claimed.has(item.id) ? item.seasonXp : 0), 0);
  if (migrationXp > 0) seasonalCampaign = grantSeasonXp(seasonalCampaign, migrationXp, payload.lastSeenAt);

  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  for (const [id, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state) continue;
    mines[id] = {
      ...state,
      rebuildLevel: Math.max(0, Math.floor(state.rebuildLevel ?? 0)),
      rebuildCycleCashEarned: Math.max(0, state.rebuildCycleCashEarned ?? state.totalCashEarned ?? 0),
    };
  }

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists: sanitizeSpecialistSystem(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(payload.world.academy ?? DEFAULT_ACADEMY_STATE),
      equipment: sanitizeEquipmentState(payload.world.equipment ?? DEFAULT_EQUIPMENT_STATE),
      collection: sanitizeCollectionState(payload.world.collection ?? DEFAULT_COLLECTION_STATE),
      relics: sanitizeRelicState(payload.world.relics ?? DEFAULT_RELIC_STATE),
      weeklyContract,
      seasonalCampaign,
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines,
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}


function migrateStageEleven(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 9) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  for (const [id, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state) continue;
    mines[id] = {
      ...state,
      rebuildLevel: Math.max(0, Math.floor(state.rebuildLevel ?? 0)),
      rebuildCycleCashEarned: Math.max(0, state.rebuildCycleCashEarned ?? state.totalCashEarned ?? 0),
    };
  }

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists: sanitizeSpecialistSystem(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(payload.world.academy ?? DEFAULT_ACADEMY_STATE),
      equipment: sanitizeEquipmentState(payload.world.equipment ?? DEFAULT_EQUIPMENT_STATE),
      collection: sanitizeCollectionState(payload.world.collection ?? DEFAULT_COLLECTION_STATE),
      relics: sanitizeRelicState(payload.world.relics ?? DEFAULT_RELIC_STATE),
      weeklyContract: createWeeklyContractState(payload.lastSeenAt),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines,
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageTen(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 8) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists: sanitizeSpecialistSystem(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(payload.world.academy ?? DEFAULT_ACADEMY_STATE),
      equipment: sanitizeEquipmentState(DEFAULT_EQUIPMENT_STATE),
      collection: sanitizeCollectionState(DEFAULT_COLLECTION_STATE),
      relics: sanitizeRelicState(DEFAULT_RELIC_STATE),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines: { ...payload.world.mines },
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageNine(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 7) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const mines = { ...payload.world.mines };
  const totalRebuilds = Object.values(mines).reduce((sum, state) => sum + Math.max(0, Math.floor(state?.rebuildLevel ?? 0)), 0);
  const specialists = migrateStageNineSpecialists(payload.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM, totalRebuilds);
  const academy = grantAcademyMigrationResources(sanitizeAcademyState(DEFAULT_ACADEMY_STATE), specialists);

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists,
      academy,
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines,
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageEight(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 6) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: sanitizeResearchState(payload.world.research ?? DEFAULT_RESEARCH_STATE),
      specialists: sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(DEFAULT_ACADEMY_STATE),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines: { ...payload.world.mines },
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageSeven(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 5) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const rebuildLevels = Object.values(payload.world.mines).reduce((sum, state) => sum + Math.max(0, Math.floor(state?.rebuildLevel ?? 0)), 0);
  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: { ...DEFAULT_RESEARCH_STATE, cores: DEFAULT_RESEARCH_STATE.cores + rebuildLevels * 2, purchased: [] },
      specialists: sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(DEFAULT_ACADEMY_STATE),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(payload.world.unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...payload.world.unlockedMines],
      mines: { ...payload.world.mines },
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageSix(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 4) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const unlockedMines = payload.world.unlockedMines;
  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  for (const [id, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state) continue;
    mines[id] = {
      ...state,
      rebuildLevel: 0,
      rebuildCycleCashEarned: Math.max(0, state.totalCashEarned ?? 0),
    };
  }

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: payload.world.activeMineId,
      research: { ...DEFAULT_RESEARCH_STATE, purchased: [] },
      specialists: sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(DEFAULT_ACADEMY_STATE),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: payload.world.unlockedSectors ?? inferUnlockedSectors(unlockedMines),
      sectorWallets: { ...(payload.world.sectorWallets ?? {}) },
      unlockedMines: [...unlockedMines],
      mines,
      lastSimulatedAt: { ...(payload.world.lastSimulatedAt ?? {}) },
    },
  };
}

function migrateStageFive(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== 3) return null;
  const payload = record.payload as Partial<StageFiveSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const knownIds = new Set(WORLD_MINES.map((mine) => mine.id));
  const unlockedMines = payload.world.unlockedMines.filter((id) => knownIds.has(id));
  const mines: Partial<Record<MineId, PersistentMineState>> = {};
  const sectorWallets: Partial<Record<SectorId, number>> = {};

  for (const [rawId, state] of Object.entries(payload.world.mines) as [MineId, PersistentMineState][]) {
    if (!state || !knownIds.has(rawId)) continue;
    const sectorId = getMineDefinition(rawId).sectorId;
    sectorWallets[sectorId] = (sectorWallets[sectorId] ?? 0) + Math.max(0, state.cash ?? 0);
    mines[rawId] = stripMineCash(state);
  }

  const activeMineId = unlockedMines.includes(payload.world.activeMineId)
    ? payload.world.activeMineId
    : unlockedMines[0] ?? DEFAULT_MINE_ID;

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId,
      research: { ...DEFAULT_RESEARCH_STATE, purchased: [] },
      specialists: sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(DEFAULT_ACADEMY_STATE),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: inferUnlockedSectors(unlockedMines),
      sectorWallets,
      unlockedMines: unlockedMines.length ? unlockedMines : [DEFAULT_MINE_ID],
      mines,
      lastSimulatedAt: { ...payload.world.lastSimulatedAt },
    },
  };
}

function migrateLegacy(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion > 2) return null;
  const payload = record.payload as Partial<LegacySave> | null;
  if (!payload?.mine || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;

  const wallet = Math.max(0, payload.mine.cash ?? 0);
  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: DEFAULT_MINE_ID,
      research: { ...DEFAULT_RESEARCH_STATE, purchased: [] },
      specialists: sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM),
      academy: sanitizeAcademyState(DEFAULT_ACADEMY_STATE),
      social: createSocialState(payload.lastSeenAt),
      unlockedSectors: [DEFAULT_SECTOR_ID],
      sectorWallets: { [DEFAULT_SECTOR_ID]: wallet },
      unlockedMines: [DEFAULT_MINE_ID],
      mines: { [DEFAULT_MINE_ID]: stripMineCash(payload.mine) },
      lastSimulatedAt: { [DEFAULT_MINE_ID]: payload.lastSeenAt },
    },
  };
}

export function parseSaveRecord(record: SaveRecord | undefined): DeepforgeSave | null {
  if (!record) return null;
  return parseStageThirteen(record) ?? migrateStageThirteen(record) ?? migrateStageTwelve(record) ?? migrateStageEleven(record) ?? migrateStageTen(record) ?? migrateStageNine(record) ?? migrateStageEight(record) ?? migrateStageSeven(record) ?? migrateStageSix(record) ?? migrateStageFive(record) ?? migrateLegacy(record);
}
