import Dexie, { type EntityTable } from 'dexie';

export interface SaveRecord {
  id: 'primary';
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
