export type ShaftId = 'shaft-1' | 'shaft-2' | 'shaft-3';
export type FacilityId = ShaftId | 'lift' | 'hub';

export type TaskKind = 'mining' | 'lift' | 'hub';

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

export interface MineState {
  cash: number;
  surfaceBuffer: number;
  resourcePrice: number;
  shafts: ShaftState[];
  lift: LiftState;
  hub: HubState;
  totalOreMined: number;
  totalCashEarned: number;
}

export interface PersistentMineState {
  cash: number;
  surfaceBuffer: number;
  shaftLevels: Record<ShaftId, number>;
  shaftBuffers: Record<ShaftId, number>;
  liftLevel: number;
  hubLevel: number;
  totalOreMined: number;
  totalCashEarned: number;
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
}
