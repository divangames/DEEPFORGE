import { create } from 'zustand';
import type { QualityTier } from '../core/device';
import { detectQualityTier } from '../core/device';
import type {
  BarrierView,
  BottleneckView,
  BulkUpgradeQuotes,
  FacilityId,
  FacilityStats,
  ManagerView,
  MineId,
  MineState,
  OfflineProgressReport,
  SectorId,
  WorldMineView,
  WorldSectorView,
} from '../game/core/types';

interface GameState {
  quality: QualityTier;
  apiOnline: boolean | null;
  simulation: MineState | null;
  activeMineId: MineId;
  activeSectorId: SectorId;
  worldMines: WorldMineView[];
  worldSectors: WorldSectorView[];
  selectedFacility: FacilityId;
  selectedStats: FacilityStats | null;
  selectedManager: ManagerView | null;
  managerRoster: ManagerView[];
  selectedBulkQuotes: BulkUpgradeQuotes | null;
  bottleneck: BottleneckView | null;
  barrier: BarrierView | null;
  canUpgradeSelected: boolean;
  offlineReport: OfflineProgressReport | null;
  setApiOnline: (online: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  setOfflineReport: (report: OfflineProgressReport | null) => void;
  syncSimulation: (
    simulation: MineState,
    selectedFacility: FacilityId,
    selectedStats: FacilityStats,
    canUpgradeSelected: boolean,
    selectedManager: ManagerView | null,
    managerRoster: ManagerView[],
    selectedBulkQuotes: BulkUpgradeQuotes,
    bottleneck: BottleneckView,
    barrier: BarrierView | null,
    activeMineId: MineId,
    activeSectorId: SectorId,
    worldMines: WorldMineView[],
    worldSectors: WorldSectorView[],
  ) => void;
}

export const useGameStore = create<GameState>((set) => ({
  quality: detectQualityTier(),
  apiOnline: null,
  simulation: null,
  activeMineId: 'rust-01',
  activeSectorId: 'rust',
  worldMines: [],
  worldSectors: [],
  selectedFacility: 'shaft-1',
  selectedStats: null,
  selectedManager: null,
  managerRoster: [],
  selectedBulkQuotes: null,
  bottleneck: null,
  barrier: null,
  canUpgradeSelected: false,
  offlineReport: null,
  setApiOnline: (apiOnline) => set({ apiOnline }),
  setQuality: (quality) => set({ quality }),
  setOfflineReport: (offlineReport) => set({ offlineReport }),
  syncSimulation: (
    simulation,
    selectedFacility,
    selectedStats,
    canUpgradeSelected,
    selectedManager,
    managerRoster,
    selectedBulkQuotes,
    bottleneck,
    barrier,
    activeMineId,
    activeSectorId,
    worldMines,
    worldSectors,
  ) => set({
    simulation,
    selectedFacility,
    selectedStats,
    canUpgradeSelected,
    selectedManager,
    managerRoster,
    selectedBulkQuotes,
    bottleneck,
    barrier,
    activeMineId,
    activeSectorId,
    worldMines,
    worldSectors,
  }),
}));
