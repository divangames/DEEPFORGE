import { create } from 'zustand';
import type { QualityTier } from '../core/device';
import { detectQualityTier } from '../core/device';
import type { SpecialistSystemView } from '../game/core/specialists';
import type { AcademyView } from '../game/core/academy';
import type { EquipmentView } from '../game/core/equipment';
import type { CollectionView } from '../game/core/collection';
import type { RelicView } from '../game/core/relics';
import type { WeeklyContractView } from '../game/core/weeklyContract';
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
  RebuildView,
  ResearchView,
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
  rebuild: RebuildView | null;
  research: ResearchView | null;
  specialists: SpecialistSystemView | null;
  academy: AcademyView | null;
  equipment: EquipmentView | null;
  collection: CollectionView | null;
  relics: RelicView | null;
  weeklyContract: WeeklyContractView | null;
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
    rebuild: RebuildView,
    research: ResearchView,
    specialists: SpecialistSystemView,
    academy: AcademyView,
    equipment: EquipmentView,
    collection: CollectionView,
    relics: RelicView,
    weeklyContract: WeeklyContractView,
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
  rebuild: null,
  research: null,
  specialists: null,
  academy: null,
  equipment: null,
  collection: null,
  relics: null,
  weeklyContract: null,
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
    rebuild,
    research,
    specialists,
    academy,
    equipment,
    collection,
    relics,
    weeklyContract,
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
    rebuild,
    research,
    specialists,
    academy,
    equipment,
    collection,
    relics,
    weeklyContract,
    activeMineId,
    activeSectorId,
    worldMines,
    worldSectors,
  }),
}));
