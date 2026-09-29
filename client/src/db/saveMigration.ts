import { APP_CONFIG } from '../config/appConfig';
import type { PersistentMineState, PersistentWorldState } from '../game/core/types';
import { DEFAULT_MINE_ID } from '../game/core/worldConfig';
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

function isSettings(value: unknown): value is DeepforgeSave['settings'] {
  if (!value || typeof value !== 'object') return false;
  const quality = (value as { quality?: unknown }).quality;
  return quality === 'LOW' || quality === 'MEDIUM' || quality === 'HIGH';
}

function parseStageFive(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion !== APP_CONFIG.saveSchemaVersion) return null;
  const payload = record.payload as Partial<DeepforgeSave> | null;
  if (!payload?.world || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;
  if (!payload.world.activeMineId || !Array.isArray(payload.world.unlockedMines) || !payload.world.mines) return null;
  return payload as DeepforgeSave;
}

function migrateLegacy(record: SaveRecord): DeepforgeSave | null {
  if (record.schemaVersion > 2) return null;
  const payload = record.payload as Partial<LegacySave> | null;
  if (!payload?.mine || !isSettings(payload.settings) || typeof payload.createdAt !== 'number' || typeof payload.lastSeenAt !== 'number') return null;

  return {
    createdAt: payload.createdAt,
    lastSeenAt: payload.lastSeenAt,
    settings: payload.settings,
    world: {
      activeMineId: DEFAULT_MINE_ID,
      unlockedMines: [DEFAULT_MINE_ID],
      mines: { [DEFAULT_MINE_ID]: payload.mine },
      lastSimulatedAt: { [DEFAULT_MINE_ID]: payload.lastSeenAt },
    },
  };
}

export function parseSaveRecord(record: SaveRecord | undefined): DeepforgeSave | null {
  if (!record) return null;
  return parseStageFive(record) ?? migrateLegacy(record);
}
