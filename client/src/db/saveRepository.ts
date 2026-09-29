import { APP_CONFIG } from '../config/appConfig';
import { gameDb } from './gameDb';
import { parseSaveRecord, type DeepforgeSave } from './saveMigration';

export type { DeepforgeSave } from './saveMigration';

export async function saveGameState(payload: DeepforgeSave) {
  await gameDb.transaction('rw', gameDb.saves, async () => {
    const current = await gameDb.saves.get('primary');
    if (current) await gameDb.saves.put({ ...current, id: 'backup' });

    await gameDb.saves.put({
      id: 'primary',
      schemaVersion: APP_CONFIG.saveSchemaVersion,
      updatedAt: Date.now(),
      payload,
    });
  });
}

export async function loadGameState(): Promise<DeepforgeSave | null> {
  const primary = parseSaveRecord(await gameDb.saves.get('primary'));
  if (primary) return primary;
  return parseSaveRecord(await gameDb.saves.get('backup'));
}

// Совместимые имена оставлены, чтобы старые ветки/тесты не ломались при merge.
export const saveStageOneState = saveGameState;
export const loadStageOneState = loadGameState;
