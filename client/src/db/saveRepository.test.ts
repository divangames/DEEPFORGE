import { describe, expect, it } from 'vitest';
import type { SaveRecord } from './gameDb';
import { parseSaveRecord } from './saveMigration';

const legacyMine = {
  cash: 123,
  surfaceBuffer: 0,
  shaftLevels: { 'shaft-1': 7 },
  shaftBuffers: { 'shaft-1': 0 },
  liftLevel: 2,
  hubLevel: 3,
  totalOreMined: 456,
  totalCashEarned: 789,
};

describe('Stage 5 save migration', () => {
  it('переносит старую одиночную шахту в rust-01 без потери прогресса', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 2,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'HIGH' },
        mine: legacyMine,
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.activeMineId).toBe('rust-01');
    expect(migrated?.world.unlockedMines).toEqual(['rust-01']);
    expect(migrated?.world.mines['rust-01']?.cash).toBe(123);
    expect(migrated?.world.mines['rust-01']?.shaftLevels['shaft-1']).toBe(7);
    expect(migrated?.world.lastSimulatedAt['rust-01']).toBe(900);
  });
});
