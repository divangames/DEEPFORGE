import { APP_CONFIG } from '../config/appConfig';
import type { PersistentMineState } from '../game/core/types';
import { gameDb, type SaveRecord } from './gameDb';

export interface StageOneSave {
  createdAt: number;
  lastSeenAt: number;
  settings: {
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  mine: PersistentMineState;
}

function parseSave(record: SaveRecord | undefined): StageOneSave | null {
  if (!record || record.schemaVersion !== APP_CONFIG.saveSchemaVersion) return null;

  const payload = record.payload as Partial<StageOneSave> | null;
  if (!payload?.mine || !payload.settings || typeof payload.lastSeenAt !== 'number') return null;
  return payload as StageOneSave;
}

export async function saveStageOneState(payload: StageOneSave) {
  await gameDb.transaction('rw', gameDb.saves, async () => {
    const current = await gameDb.saves.get('primary');
    if (current) {
      await gameDb.saves.put({ ...current, id: 'backup' });
    }

    await gameDb.saves.put({
      id: 'primary',
      schemaVersion: APP_CONFIG.saveSchemaVersion,
      updatedAt: Date.now(),
      payload,
    });
  });
}

export async function loadStageOneState(): Promise<StageOneSave | null> {
  const primary = parseSave(await gameDb.saves.get('primary'));
  if (primary) return primary;

  // Если основной слот повреждён, пробуем последний корректный backup.
  return parseSave(await gameDb.saves.get('backup'));
}
