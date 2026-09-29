import { STAGE_ONE_BALANCE } from './balance';
import { formatCompact } from './format';
import type {
  FacilityId,
  FacilityStats,
  HubState,
  LiftState,
  MineState,
  PersistentMineState,
  ShaftId,
  ShaftState,
} from './types';

const EPSILON = 0.0001;

function cloneState(state: MineState): MineState {
  return {
    ...state,
    shafts: state.shafts.map((shaft) => ({ ...shaft, task: shaft.task ? { ...shaft.task } : null })),
    lift: { ...state.lift, task: state.lift.task ? { ...state.lift.task } : null },
    hub: { ...state.hub, task: state.hub.task ? { ...state.hub.task } : null },
  };
}

export class MineSimulation {
  private state: MineState;

  constructor(persisted?: PersistentMineState | null) {
    const shafts: ShaftState[] = (Object.keys(STAGE_ONE_BALANCE.shafts) as ShaftId[]).map((id) => {
      const config = STAGE_ONE_BALANCE.shafts[id];
      return {
        id,
        name: config.name,
        depth: config.depth,
        level: persisted?.shaftLevels[id] ?? 1,
        buffer: persisted?.shaftBuffers[id] ?? 0,
        baseYield: config.baseYield,
        baseDuration: config.baseDuration,
        task: null,
      };
    });

    this.state = {
      cash: persisted?.cash ?? 0,
      surfaceBuffer: persisted?.surfaceBuffer ?? 0,
      resourcePrice: STAGE_ONE_BALANCE.resourcePrice,
      shafts,
      lift: {
        level: persisted?.liftLevel ?? 1,
        cargo: 0,
        task: null,
      },
      hub: {
        level: persisted?.hubLevel ?? 1,
        cargo: 0,
        task: null,
      },
      totalOreMined: persisted?.totalOreMined ?? 0,
      totalCashEarned: persisted?.totalCashEarned ?? 0,
    };
  }

  getState(): MineState {
    return cloneState(this.state);
  }

  getSnapshot(): MineState {
    return this.getState();
  }

  serialize(): PersistentMineState {
    const shaftLevels = {} as Record<ShaftId, number>;
    const shaftBuffers = {} as Record<ShaftId, number>;

    for (const shaft of this.state.shafts) {
      shaftLevels[shaft.id] = shaft.level;
      shaftBuffers[shaft.id] = shaft.buffer;
    }

    return {
      cash: this.state.cash,
      surfaceBuffer: this.state.surfaceBuffer,
      shaftLevels,
      shaftBuffers,
      liftLevel: this.state.lift.level,
      hubLevel: this.state.hub.level,
      totalOreMined: this.state.totalOreMined,
      totalCashEarned: this.state.totalCashEarned,
    };
  }

  startMining(id: ShaftId): boolean {
    const shaft = this.getShaft(id);
    if (!shaft || shaft.task) return false;

    shaft.task = {
      kind: 'mining',
      elapsed: 0,
      duration: this.getShaftDuration(shaft),
    };
    return true;
  }

  startLift(): boolean {
    if (this.state.lift.task) return false;

    const source = [...this.state.shafts]
      .sort((a, b) => b.depth - a.depth)
      .find((shaft) => shaft.buffer > EPSILON);

    if (!source) return false;

    this.state.lift.task = {
      kind: 'lift',
      elapsed: 0,
      duration: this.getLiftDuration(this.state.lift),
      sourceShaftId: source.id,
      cargo: 0,
      pickedUp: false,
    };
    return true;
  }

  startHub(): boolean {
    if (this.state.hub.task || this.state.surfaceBuffer <= EPSILON) return false;

    const cargo = Math.min(this.state.surfaceBuffer, this.getHubCapacity(this.state.hub));
    this.state.surfaceBuffer -= cargo;
    this.state.hub.cargo = cargo;
    this.state.hub.task = {
      kind: 'hub',
      elapsed: 0,
      duration: this.getHubDuration(this.state.hub),
      cargo,
      pickedUp: true,
    };
    return true;
  }

  tick(deltaSeconds: number): void {
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.25);

    for (const shaft of this.state.shafts) {
      if (!shaft.task) continue;
      shaft.task.elapsed += delta;
      if (shaft.task.elapsed + EPSILON >= shaft.task.duration) {
        const ore = this.getShaftYield(shaft);
        shaft.buffer += ore;
        this.state.totalOreMined += ore;
        shaft.task = null;
      }
    }

    const liftTask = this.state.lift.task;
    if (liftTask) {
      liftTask.elapsed += delta;
      const progress = Math.min(1, liftTask.elapsed / liftTask.duration);

      if (!liftTask.pickedUp && progress >= 0.47 && liftTask.sourceShaftId) {
        const shaft = this.getShaft(liftTask.sourceShaftId);
        if (shaft) {
          const cargo = Math.min(shaft.buffer, this.getLiftCapacity(this.state.lift));
          shaft.buffer -= cargo;
          this.state.lift.cargo = cargo;
          liftTask.cargo = cargo;
          liftTask.pickedUp = true;
        }
      }

      if (progress >= 1) {
        this.state.surfaceBuffer += this.state.lift.cargo;
        this.state.lift.cargo = 0;
        this.state.lift.task = null;
      }
    }

    const hubTask = this.state.hub.task;
    if (hubTask) {
      hubTask.elapsed += delta;
      if (hubTask.elapsed + EPSILON >= hubTask.duration) {
        const cargo = this.state.hub.cargo;
        const revenue = cargo * this.state.resourcePrice;
        this.state.cash += revenue;
        this.state.totalCashEarned += revenue;
        this.state.hub.cargo = 0;
        this.state.hub.task = null;
      }
    }
  }

  upgrade(id: FacilityId): boolean {
    const cost = this.getUpgradeCost(id);
    if (this.state.cash + EPSILON < cost) return false;

    this.state.cash -= cost;

    if (id === 'lift') {
      this.state.lift.level += 1;
      return true;
    }

    if (id === 'hub') {
      this.state.hub.level += 1;
      return true;
    }

    const shaft = this.getShaft(id);
    if (!shaft) return false;
    shaft.level += 1;
    return true;
  }

  canUpgrade(id: FacilityId): boolean {
    return this.state.cash + EPSILON >= this.getUpgradeCost(id);
  }

  getFacilityStats(id: FacilityId): FacilityStats {
    if (id === 'lift') {
      return {
        id,
        name: 'Cargo Lift',
        level: this.state.lift.level,
        upgradeCost: this.getUpgradeCost(id),
        primaryLabel: 'Вместимость',
        primaryValue: `${formatCompact(this.getLiftCapacity(this.state.lift))} ore`,
        secondaryLabel: 'Цикл',
        secondaryValue: `${this.getLiftDuration(this.state.lift).toFixed(2)} сек`,
      };
    }

    if (id === 'hub') {
      return {
        id,
        name: 'Logistics Hub',
        level: this.state.hub.level,
        upgradeCost: this.getUpgradeCost(id),
        primaryLabel: 'Вместимость',
        primaryValue: `${formatCompact(this.getHubCapacity(this.state.hub))} ore`,
        secondaryLabel: 'Цикл',
        secondaryValue: `${this.getHubDuration(this.state.hub).toFixed(2)} сек`,
      };
    }

    const shaft = this.getShaft(id)!;
    return {
      id,
      name: shaft.name,
      level: shaft.level,
      upgradeCost: this.getUpgradeCost(id),
      primaryLabel: 'За цикл',
      primaryValue: `${formatCompact(this.getShaftYield(shaft))} ore`,
      secondaryLabel: 'Цикл',
      secondaryValue: `${this.getShaftDuration(shaft).toFixed(2)} сек`,
    };
  }

  getUpgradeCost(id: FacilityId): number {
    const level = id === 'lift'
      ? this.state.lift.level
      : id === 'hub'
        ? this.state.hub.level
        : this.getShaft(id)?.level ?? 1;

    const base = id === 'lift'
      ? STAGE_ONE_BALANCE.upgrades.liftBaseCost
      : id === 'hub'
        ? STAGE_ONE_BALANCE.upgrades.hubBaseCost
        : STAGE_ONE_BALANCE.upgrades.shaftBaseCost;

    return Math.floor(base * Math.pow(STAGE_ONE_BALANCE.upgrades.growth, level - 1));
  }

  getShaftYield(shaft: ShaftState): number {
    const multiplier = 1 + STAGE_ONE_BALANCE.upgrades.shaftYieldPerLevel * (shaft.level - 1);
    return Math.floor(shaft.baseYield * multiplier);
  }

  getShaftDuration(shaft: ShaftState): number {
    return this.applySpeedUpgrade(shaft.baseDuration, shaft.level);
  }

  getLiftCapacity(lift: LiftState): number {
    const multiplier = 1 + STAGE_ONE_BALANCE.upgrades.liftCapacityPerLevel * (lift.level - 1);
    return Math.floor(STAGE_ONE_BALANCE.lift.baseCapacity * multiplier);
  }

  getLiftDuration(lift: LiftState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.lift.baseDuration, lift.level);
  }

  getHubCapacity(hub: HubState): number {
    const multiplier = 1 + STAGE_ONE_BALANCE.upgrades.hubCapacityPerLevel * (hub.level - 1);
    return Math.floor(STAGE_ONE_BALANCE.hub.baseCapacity * multiplier);
  }

  getHubDuration(hub: HubState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.hub.baseDuration, hub.level);
  }

  private applySpeedUpgrade(baseDuration: number, level: number): number {
    const reduction = Math.min(
      STAGE_ONE_BALANCE.upgrades.maxSpeedReduction,
      STAGE_ONE_BALANCE.upgrades.speedPerLevel * (level - 1),
    );
    return baseDuration * (1 - reduction);
  }

  private getShaft(id: ShaftId): ShaftState | undefined {
    return this.state.shafts.find((shaft) => shaft.id === id);
  }
}
