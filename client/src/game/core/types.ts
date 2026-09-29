export type ShaftId = `shaft-${number}`;
export type FacilityId = ShaftId | 'lift' | 'hub';
export type TaskKind = 'mining' | 'lift' | 'hub';
export type BulkUpgradeMode = 1 | 10 | 25 | 'MAX';

export interface TimedTask {
  kind: TaskKind;
  elapsed: number;
  duration: number;
  sourceShaftId?: ShaftId;
  cargo?: number;
  pickedUp?: boolean;
}

export interface ShaftState {
  id: ShaftId;
  name: string;
  depth: number;
  level: number;
  buffer: number;
  baseYield: number;
  baseDuration: number;
  unlocked: boolean;
  task: TimedTask | null;
}

export interface LiftState {
  level: number;
  cargo: number;
  task: TimedTask | null;
}

export interface HubState {
  level: number;
  cargo: number;
  task: TimedTask | null;
}

export interface ManagerState {
  facilityId: FacilityId;
  hired: boolean;
  activeRemaining: number;
  cooldownRemaining: number;
}

export interface BarrierState {
  maxAccessibleDepth: number;
  remaining: number;
}

export interface MineState {
  cash: number;
  surfaceBuffer: number;
  resourcePrice: number;
  shafts: ShaftState[];
  lift: LiftState;
  hub: HubState;
  managers: Record<string, ManagerState>;
  barrier: BarrierState;
  totalOreMined: number;
  totalCashEarned: number;
}

export interface PersistentManagerState {
  hired: boolean;
  activeRemaining: number;
  cooldownRemaining: number;
}

export interface PersistentMineState {
  cash: number;
  surfaceBuffer: number;
  shaftLevels: Partial<Record<ShaftId, number>>;
  shaftBuffers: Partial<Record<ShaftId, number>>;
  unlockedShafts?: ShaftId[];
  maxAccessibleDepth?: number;
  barrierRemaining?: number;
  liftLevel: number;
  hubLevel: number;
  managers?: Partial<Record<string, PersistentManagerState>>;
  totalOreMined: number;
  totalCashEarned: number;
}

export interface OfflineProgressReport {
  rawSeconds: number;
  creditedSeconds: number;
  rewardCash: number;
  processedOre: number;
  incomePerSecond: number;
  capped: boolean;
  fullChainAutomated: boolean;
  automatedShafts: number;
}

export interface MilestoneView {
  currentMultiplier: number;
  nextLevel: number | null;
  nextMultiplier: number | null;
}

export interface FacilityStats {
  id: FacilityId;
  name: string;
  level: number;
  upgradeCost: number;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  isUnlocked: boolean;
  isAccessible: boolean;
  unlockCost: number;
  canUnlock: boolean;
  milestone: MilestoneView;
}

export interface BulkUpgradeQuote {
  mode: BulkUpgradeMode;
  levels: number;
  totalCost: number;
  affordable: boolean;
}

export interface BulkUpgradeQuotes {
  x1: BulkUpgradeQuote;
  x10: BulkUpgradeQuote;
  x25: BulkUpgradeQuote;
  max: BulkUpgradeQuote;
}

export interface ManagerView {
  facilityId: FacilityId;
  name: string;
  role: string;
  hired: boolean;
  hireCost: number;
  canHire: boolean;
  passiveBonusPercent: number;
  abilityName: string;
  abilityMultiplier: number;
  abilityDuration: number;
  activeRemaining: number;
  cooldownRemaining: number;
  abilityReady: boolean;
}

export type BottleneckKind = 'shafts' | 'lift' | 'hub';

export interface BottleneckView {
  shaftOrePerSecond: number;
  liftOrePerSecond: number;
  hubOrePerSecond: number;
  effectiveOrePerSecond: number;
  incomePerSecond: number;
  bottleneck: BottleneckKind;
  label: string;
}

export interface BarrierView {
  boundaryDepth: number;
  targetDepth: number;
  cost: number;
  duration: number;
  remaining: number;
  active: boolean;
  cleared: boolean;
  requirementsMet: boolean;
  canStart: boolean;
}
