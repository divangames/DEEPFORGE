import { APP_CONFIG } from '../config/appConfig';
import type { PersistentMineState } from '../game/core/types';
import { gameDb } from './gameDb';

export interface StageOneSave {
  createdAt: number;
  lastSeenAt: number;
  settings: {
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  mine: PersistentMineState;
}

export async function saveStageOneState(payload: StageOneSave) {
  await gameDb.saves.put({
    id: 'primary',
    schemaVersion: APP_CONFIG.saveSchemaVersion,
    updatedAt: Date.now(),
    payload,
  });
}

export async function loadStageOneState(): Promise<StageOneSave | null> {
  const record = await gameDb.saves.get('primary');
  if (!record || record.schemaVersion !== APP_CONFIG.saveSchemaVersion) return null;

  const payload = record.payload as Partial<StageOneSave> | null;
  if (!payload?.mine || !payload.settings) return null;
  return payload as StageOneSave;
}
