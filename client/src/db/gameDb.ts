import Dexie, { type EntityTable } from 'dexie';

export type SaveSlot = 'primary' | 'backup';

export interface SaveRecord {
  id: SaveSlot;
  schemaVersion: number;
  updatedAt: number;
  payload: unknown;
}

class GameDatabase extends Dexie {
  saves!: EntityTable<SaveRecord, 'id'>;

  constructor() {
    super('deepforge');
    this.version(1).stores({
      saves: '&id, schemaVersion, updatedAt',
    });
  }
}

export const gameDb = new GameDatabase();
