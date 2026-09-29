import { APP_CONFIG } from '../config/appConfig';
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

function parseStageSix(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== APP_CONFIG.saveSchemaVersion) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;

  const unlockedMines = payload.world.unlockedMines;
  payload.world.unlockedSectors ??= inferUnlockedSectors(unlockedMines);
  payload.world.sectorWallets ??= {};
  return payload as DeepforgeSave;
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
  return parseStageSix(record) ?? migrateStageFive(record) ?? migrateLegacy(record);
}
