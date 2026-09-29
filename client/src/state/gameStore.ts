import { create } from 'zustand';
import type { QualityTier } from '../core/device';
import { detectQualityTier } from '../core/device';
import type { FacilityId, FacilityStats, ManagerView, MineState } from '../game/core/types';

interface GameState {
  quality: QualityTier;
  apiOnline: boolean | null;
  simulation: MineState | null;
  selectedFacility: FacilityId;
  selectedStats: FacilityStats | null;
  selectedManager: ManagerView | null;
  managerRoster: ManagerView[];
  canUpgradeSelected: boolean;
  setApiOnline: (online: boolean) => void;
  setQuality: (quality: QualityTier) => void;
  syncSimulation: (
    simulation: MineState,
    selectedFacility: FacilityId,
    selectedStats: FacilityStats,
    canUpgradeSelected: boolean,
    selectedManager: ManagerView,
    managerRoster: ManagerView[],
  ) => void;
}

export const useGameStore = create<GameState>((set) => ({
  quality: detectQualityTier(),
  apiOnline: null,
  simulation: null,
  selectedFacility: 'shaft-1',
  selectedStats: null,
  selectedManager: null,
  managerRoster: [],
  canUpgradeSelected: false,
  setApiOnline: (apiOnline) => set({ apiOnline }),
  setQuality: (quality) => set({ quality }),
  syncSimulation: (
    simulation,
    selectedFacility,
    selectedStats,
    canUpgradeSelected,
    selectedManager,
    managerRoster,
  ) => set({
    simulation,
    selectedFacility,
    selectedStats,
    canUpgradeSelected,
    selectedManager,
    managerRoster,
  }),
}));
