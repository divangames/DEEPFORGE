import { STAGE_ONE_BALANCE } from './balance';
import { formatCompact } from './format';
import type {
  FacilityId,
  FacilityStats,
  HubState,
  LiftState,
  ManagerState,
  ManagerView,
  MineState,
  OfflineProgressReport,
  PersistentMineState,
  ShaftId,
  ShaftState,
} from './types';

const EPSILON = 0.0001;
const FACILITY_IDS: FacilityId[] = ['shaft-1', 'shaft-2', 'shaft-3', 'lift', 'hub'];

function cloneState(state: MineState): MineState {
  const managers = {} as Record<FacilityId, ManagerState>;
  for (const id of FACILITY_IDS) managers[id] = { ...state.managers[id] };

  return {
    ...state,
    shafts: state.shafts.map((shaft) => ({ ...shaft, task: shaft.task ? { ...shaft.task } : null })),
    lift: { ...state.lift, task: state.lift.task ? { ...state.lift.task } : null },
    hub: { ...state.hub, task: state.hub.task ? { ...state.hub.task } : null },
    managers,
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

    const managers = {} as Record<FacilityId, ManagerState>;
    for (const id of FACILITY_IDS) {
      const saved = persisted?.managers?.[id];
      managers[id] = {
        facilityId: id,
        hired: saved?.hired ?? false,
        activeRemaining: Math.max(0, saved?.activeRemaining ?? 0),
        cooldownRemaining: Math.max(0, saved?.cooldownRemaining ?? 0),
      };
    }

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
      managers,
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
    const managers = {} as NonNullable<PersistentMineState['managers']>;

    for (const shaft of this.state.shafts) {
      shaftLevels[shaft.id] = shaft.level;
      shaftBuffers[shaft.id] = shaft.buffer;
    }

    for (const id of FACILITY_IDS) {
      const manager = this.state.managers[id];
      managers[id] = {
        hired: manager.hired,
        activeRemaining: manager.activeRemaining,
        cooldownRemaining: manager.cooldownRemaining,
      };
    }

    return {
      cash: this.state.cash,
      surfaceBuffer: this.state.surfaceBuffer,
      shaftLevels,
      shaftBuffers,
      liftLevel: this.state.lift.level,
      hubLevel: this.state.hub.level,
      managers,
      totalOreMined: this.state.totalOreMined,
      totalCashEarned: this.state.totalCashEarned,
    };
  }

  getOfflineIncomePerSecond(): number {
    const automatedShafts = this.state.shafts.filter((shaft) => this.state.managers[shaft.id].hired);
    const shaftThroughput = automatedShafts.reduce((sum, shaft) => {
      return sum + this.getShaftYield(shaft) / this.getShaftDuration(shaft);
    }, 0);

    if (shaftThroughput <= EPSILON || !this.state.managers.lift.hired || !this.state.managers.hub.hired) {
      return 0;
    }

    const liftThroughput = this.getLiftCapacity(this.state.lift) / this.getLiftDuration(this.state.lift);
    const hubThroughput = this.getHubCapacity(this.state.hub) / this.getHubDuration(this.state.hub);
    const effectiveOrePerSecond = Math.min(shaftThroughput, liftThroughput, hubThroughput);
    return effectiveOrePerSecond * this.state.resourcePrice * STAGE_ONE_BALANCE.idle.incomeMultiplier;
  }

  applyOfflineProgress(rawSeconds: number): OfflineProgressReport {
    const safeRawSeconds = Math.max(0, Number.isFinite(rawSeconds) ? rawSeconds : 0);
    const creditedSeconds = Math.min(safeRawSeconds, STAGE_ONE_BALANCE.idle.maxOfflineSeconds);
    const incomePerSecond = this.getOfflineIncomePerSecond();
    const rewardCash = incomePerSecond * creditedSeconds;
    const processedOre = this.state.resourcePrice > 0 ? rewardCash / this.state.resourcePrice : 0;

    if (rewardCash > 0) {
      this.state.cash += rewardCash;
      this.state.totalCashEarned += rewardCash;
      this.state.totalOreMined += processedOre;
    }

    // Активные способности не действуют в фоне, но их таймеры и cooldown продолжают идти.
    for (const id of FACILITY_IDS) {
      const manager = this.state.managers[id];
      manager.activeRemaining = Math.max(0, manager.activeRemaining - safeRawSeconds);
      manager.cooldownRemaining = Math.max(0, manager.cooldownRemaining - safeRawSeconds);
    }

    const automatedShafts = this.state.shafts.filter((shaft) => this.state.managers[shaft.id].hired).length;
    return {
      rawSeconds: safeRawSeconds,
      creditedSeconds,
      rewardCash,
      processedOre,
      incomePerSecond,
      capped: safeRawSeconds > creditedSeconds + EPSILON,
      fullChainAutomated: automatedShafts > 0 && this.state.managers.lift.hired && this.state.managers.hub.hired,
      automatedShafts,
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

  hireManager(id: FacilityId): boolean {
    const manager = this.state.managers[id];
    const config = STAGE_ONE_BALANCE.managers[id];
    if (manager.hired || this.state.cash + EPSILON < config.hireCost) return false;

    this.state.cash -= config.hireCost;
    manager.hired = true;
    return true;
  }

  activateManagerAbility(id: FacilityId): boolean {
    const manager = this.state.managers[id];
    const config = STAGE_ONE_BALANCE.managers[id];
    if (!manager.hired || manager.cooldownRemaining > EPSILON || manager.activeRemaining > EPSILON) return false;

    manager.activeRemaining = config.abilityDuration;
    manager.cooldownRemaining = config.abilityCooldown;
    return true;
  }

  tick(deltaSeconds: number): void {
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.25);

    // Автоматизация запускает свободные звенья цепочки без кликов игрока.
    this.ensureAutomation();

    for (const shaft of this.state.shafts) {
      if (!shaft.task) continue;
      shaft.task.elapsed += delta * this.getTaskSpeedMultiplier(shaft.id);
      if (shaft.task.elapsed + EPSILON >= shaft.task.duration) {
        const ore = this.getShaftYield(shaft);
        shaft.buffer += ore;
        this.state.totalOreMined += ore;
        shaft.task = null;
      }
    }

    const liftTask = this.state.lift.task;
    if (liftTask) {
      liftTask.elapsed += delta * this.getTaskSpeedMultiplier('lift');
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
      hubTask.elapsed += delta * this.getTaskSpeedMultiplier('hub');
      if (hubTask.elapsed + EPSILON >= hubTask.duration) {
        const cargo = this.state.hub.cargo;
        const revenue = cargo * this.state.resourcePrice;
        this.state.cash += revenue;
        this.state.totalCashEarned += revenue;
        this.state.hub.cargo = 0;
        this.state.hub.task = null;
      }
    }

    // Таймеры менеджеров работают в реальном времени, а не ускоренном игровом времени.
    for (const id of FACILITY_IDS) {
      const manager = this.state.managers[id];
      manager.activeRemaining = Math.max(0, manager.activeRemaining - delta);
      manager.cooldownRemaining = Math.max(0, manager.cooldownRemaining - delta);
    }

    // Если цикл закончился в этом tick, менеджер может сразу поставить следующий в очередь.
    this.ensureAutomation();
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

  getManagerView(id: FacilityId): ManagerView {
    const manager = this.state.managers[id];
    const config = STAGE_ONE_BALANCE.managers[id];
    return {
      facilityId: id,
      name: config.name,
      role: config.role,
      hired: manager.hired,
      hireCost: config.hireCost,
      canHire: !manager.hired && this.state.cash + EPSILON >= config.hireCost,
      passiveBonusPercent: Math.round((config.passiveMultiplier - 1) * 100),
      abilityName: config.abilityName,
      abilityMultiplier: config.abilityMultiplier,
      abilityDuration: config.abilityDuration,
      activeRemaining: manager.activeRemaining,
      cooldownRemaining: manager.cooldownRemaining,
      abilityReady: manager.hired && manager.cooldownRemaining <= EPSILON && manager.activeRemaining <= EPSILON,
    };
  }

  getManagerRoster(): ManagerView[] {
    return FACILITY_IDS.map((id) => this.getManagerView(id));
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
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.shaftYieldPerLevel * (shaft.level - 1);
    return Math.round(shaft.baseYield * levelMultiplier * this.getPassiveMultiplier(shaft.id));
  }

  getShaftDuration(shaft: ShaftState): number {
    return this.applySpeedUpgrade(shaft.baseDuration, shaft.level);
  }

  getLiftCapacity(lift: LiftState): number {
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.liftCapacityPerLevel * (lift.level - 1);
    return Math.floor(STAGE_ONE_BALANCE.lift.baseCapacity * levelMultiplier * this.getPassiveMultiplier('lift'));
  }

  getLiftDuration(lift: LiftState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.lift.baseDuration, lift.level);
  }

  getHubCapacity(hub: HubState): number {
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.hubCapacityPerLevel * (hub.level - 1);
    return Math.floor(STAGE_ONE_BALANCE.hub.baseCapacity * levelMultiplier * this.getPassiveMultiplier('hub'));
  }

  getHubDuration(hub: HubState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.hub.baseDuration, hub.level);
  }

  private getPassiveMultiplier(id: FacilityId): number {
    return this.state.managers[id].hired ? STAGE_ONE_BALANCE.managers[id].passiveMultiplier : 1;
  }

  private getTaskSpeedMultiplier(id: FacilityId): number {
    const manager = this.state.managers[id];
    if (!manager.hired || manager.activeRemaining <= EPSILON) return 1;
    return STAGE_ONE_BALANCE.managers[id].abilityMultiplier;
  }

  private ensureAutomation(): void {
    for (const shaft of this.state.shafts) {
      if (this.state.managers[shaft.id].hired && !shaft.task) this.startMining(shaft.id);
    }

    if (this.state.managers.lift.hired && !this.state.lift.task) this.startLift();
    if (this.state.managers.hub.hired && !this.state.hub.task) this.startHub();
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
