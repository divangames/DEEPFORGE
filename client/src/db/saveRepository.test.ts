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

describe('Stage 6 save migration', () => {
  it('переносит старую одиночную шахту в rust-01 и общий кошелек Rust Valley', () => {
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
    expect(migrated?.world.unlockedSectors).toEqual(['rust']);
    expect(migrated?.world.unlockedMines).toEqual(['rust-01']);
    expect(migrated?.world.sectorWallets?.rust).toBe(123);
    expect(migrated?.world.mines['rust-01']?.cash).toBe(0);
    expect(migrated?.world.mines['rust-01']?.shaftLevels['shaft-1']).toBe(7);
    expect(migrated?.world.lastSimulatedAt['rust-01']).toBe(900);
  });

  it('суммирует отдельные кассы Stage 5 в единую валюту сектора', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 3,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'MEDIUM' },
        world: {
          activeMineId: 'rust-02',
          unlockedMines: ['rust-01', 'rust-02'],
          mines: {
            'rust-01': { ...legacyMine, cash: 100 },
            'rust-02': { ...legacyMine, cash: 250 },
          },
          lastSimulatedAt: { 'rust-01': 800, 'rust-02': 850 },
        },
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.sectorWallets?.rust).toBe(350);
    expect(migrated?.world.mines['rust-01']?.cash).toBe(0);
    expect(migrated?.world.mines['rust-02']?.cash).toBe(0);
  });
});

describe('Stage 7 save migration', () => {
  it('добавляет rebuildLevel=0 в Stage 6 save', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 4,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'HIGH' },
        world: {
          activeMineId: 'rust-01',
          unlockedSectors: ['rust'],
          sectorWallets: { rust: 500 },
          unlockedMines: ['rust-01'],
          mines: { 'rust-01': { ...legacyMine, cash: 0 } },
          lastSimulatedAt: { 'rust-01': 850 },
        },
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.mines['rust-01']?.rebuildLevel).toBe(0);
    expect(migrated?.world.mines['rust-01']?.rebuildCycleCashEarned).toBe(789);
    expect(migrated?.world.sectorWallets?.rust).toBe(500);
  });
});

describe('Stage 8 research migration', () => {
  it('добавляет Research Grid к Stage 7 save и учитывает прошлые Rebuild', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 5,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'HIGH' },
        world: {
          activeMineId: 'rust-01',
          unlockedSectors: ['rust'],
          sectorWallets: { rust: 500 },
          unlockedMines: ['rust-01'],
          mines: { 'rust-01': { ...legacyMine, cash: 0, rebuildLevel: 2, rebuildCycleCashEarned: 10 } },
          lastSimulatedAt: { 'rust-01': 850 },
        },
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.research?.cores).toBeGreaterThanOrEqual(7);
    expect(migrated?.world.research?.purchased).toEqual([]);
  });
});

describe('Stage 9 specialists migration', () => {
  it('добавляет Specialist roster к Stage 8 save без потери прогресса', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 6,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'HIGH' },
        world: {
          activeMineId: 'rust-01',
          research: { cores: 4, purchased: ['ind-1'], respecCount: 0 },
          unlockedSectors: ['rust'],
          sectorWallets: { rust: 900 },
          unlockedMines: ['rust-01'],
          mines: { 'rust-01': { ...legacyMine, cash: 0, rebuildLevel: 1, rebuildCycleCashEarned: 50 } },
          lastSimulatedAt: { 'rust-01': 850 },
        },
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.sectorWallets?.rust).toBe(900);
    expect(migrated?.world.research?.purchased).toContain('ind-1');
    expect(migrated?.world.specialists?.profiles['rook-hale']?.level).toBe(1);
  });
});

describe('Stage 10 Academy migration', () => {
  it('переносит Stage 9 Specialists в recruit/rank систему и сохраняет уже доступных персонажей', () => {
    const record: SaveRecord = {
      id: 'primary',
      schemaVersion: 7,
      updatedAt: 1000,
      payload: {
        createdAt: 10,
        lastSeenAt: 900,
        settings: { quality: 'HIGH' },
        world: {
          activeMineId: 'rust-01',
          research: { cores: 4, purchased: ['ind-1'], respecCount: 0 },
          specialists: {
            profiles: {
              'rook-hale': { level: 3, activeRemaining: 0, cooldownRemaining: 0 },
              'mara-vex': { level: 2, activeRemaining: 0, cooldownRemaining: 0 },
            },
            assignments: {},
          },
          unlockedSectors: ['rust'],
          sectorWallets: { rust: 900 },
          unlockedMines: ['rust-01'],
          mines: { 'rust-01': { ...legacyMine, cash: 0, rebuildLevel: 1, rebuildCycleCashEarned: 50 } },
          lastSimulatedAt: { 'rust-01': 850 },
        },
      },
    };

    const migrated = parseSaveRecord(record);
    expect(migrated?.world.specialists?.profiles['rook-hale']?.recruited).toBe(true);
    expect(migrated?.world.specialists?.profiles['mara-vex']?.recruited).toBe(true);
    expect(migrated?.world.specialists?.profiles['mara-vex']?.level).toBe(2);
    expect(migrated?.world.academy?.resources.trainingModules).toBeGreaterThan(60);
  });
});
