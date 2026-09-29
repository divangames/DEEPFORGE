import {
  getBarrierCost,
  getBarrierDuration,
  getManagerConfig,
  getNextRebuildTier,
  getRebuildRevenueRequirement,
  getRebuildMultiplier,
  getShaftDepth,
  getShaftUnlockCost,
  INITIAL_ACCESSIBLE_DEPTH,
  INITIAL_UNLOCKED_DEPTH,
  isShaftId,
  makeShaftId,
  SHAFT_COUNT,
  SHAFTS_PER_BARRIER,
  STAGE_ONE_BALANCE,
} from './balance';
import { formatCompact } from './format';
import { DEFAULT_MINE_TUNING, type MineTuning } from './worldConfig';
import type {
  BarrierView,
  BottleneckKind,
  BottleneckView,
  BulkUpgradeMode,
  BulkUpgradeQuote,
  BulkUpgradeQuotes,
  FacilityId,
  FacilityStats,
  HubState,
  LiftState,
  ManagerState,
  ManagerView,
  MineState,
  OfflineProgressReport,
  PersistentMineState,
  RebuildView,
  ShaftId,
  ShaftState,
} from './types';

const EPSILON = 0.0001;
const CORE_FACILITY_IDS: FacilityId[] = ['lift', 'hub'];

function allShaftIds(): ShaftId[] {
  return Array.from({ length: SHAFT_COUNT }, (_, index) => makeShaftId(index + 1));
}

function allFacilityIds(): FacilityId[] {
  return [...allShaftIds(), ...CORE_FACILITY_IDS];
}

function cloneState(state: MineState): MineState {
  const managers: Record<string, ManagerState> = {};
  for (const [id, manager] of Object.entries(state.managers)) managers[id] = { ...manager };

  return {
    ...state,
    shafts: state.shafts.map((shaft) => ({ ...shaft, task: shaft.task ? { ...shaft.task } : null })),
    lift: { ...state.lift, task: state.lift.task ? { ...state.lift.task } : null },
    hub: { ...state.hub, task: state.hub.task ? { ...state.hub.task } : null },
    managers,
    barrier: { ...state.barrier },
  };
}

export class MineSimulation {
  private state: MineState;
  private tuning: MineTuning;

  constructor(persisted?: PersistentMineState | null, tuning: MineTuning = DEFAULT_MINE_TUNING) {
    this.tuning = tuning;
    const legacyUnlocked = new Set<ShaftId>();
    if (persisted?.unlockedShafts?.length) {
      persisted.unlockedShafts.forEach((id) => legacyUnlocked.add(id));
    } else if (persisted?.shaftLevels) {
      // Миграция Stage 1–3: существовавшие в save уровни считаем уже открытыми.
      Object.keys(persisted.shaftLevels).forEach((id) => legacyUnlocked.add(id as ShaftId));
    }
    if (legacyUnlocked.size === 0) {
      for (let depth = 1; depth <= INITIAL_UNLOCKED_DEPTH; depth += 1) legacyUnlocked.add(makeShaftId(depth));
    }

    const shafts: ShaftState[] = allShaftIds().map((id) => {
      const config = STAGE_ONE_BALANCE.shafts[id];
      return {
        id,
        name: config.name,
        depth: config.depth,
        level: Math.max(1, persisted?.shaftLevels?.[id] ?? 1),
        buffer: Math.max(0, persisted?.shaftBuffers?.[id] ?? 0),
        baseYield: config.baseYield * this.tuning.yieldMultiplier,
        baseDuration: config.baseDuration * this.tuning.durationMultiplier,
        unlocked: legacyUnlocked.has(id),
        task: null,
      };
    });

    const managers: Record<string, ManagerState> = {};
    for (const id of allFacilityIds()) {
      const saved = persisted?.managers?.[id];
      managers[id] = {
        facilityId: id,
        hired: saved?.hired ?? false,
        activeRemaining: Math.max(0, saved?.activeRemaining ?? 0),
        cooldownRemaining: Math.max(0, saved?.cooldownRemaining ?? 0),
      };
    }

    const inferredAccessibleDepth = Math.max(
      INITIAL_ACCESSIBLE_DEPTH,
      Math.ceil(Math.max(...shafts.filter((shaft) => shaft.unlocked).map((shaft) => shaft.depth), INITIAL_UNLOCKED_DEPTH) / SHAFTS_PER_BARRIER) * SHAFTS_PER_BARRIER,
    );

    const rebuildLevel = Math.max(0, Math.floor(persisted?.rebuildLevel ?? 0));
    const rebuildMultiplier = getRebuildMultiplier(rebuildLevel);

    this.state = {
      cash: Math.max(0, persisted?.cash ?? 0),
      rebuildLevel,
      rebuildMultiplier,
      rebuildCycleCashEarned: Math.max(0, persisted?.rebuildCycleCashEarned ?? persisted?.totalCashEarned ?? 0),
      surfaceBuffer: Math.max(0, persisted?.surfaceBuffer ?? 0),
      resourcePrice: this.tuning.resourcePrice * rebuildMultiplier,
      shafts,
      lift: {
        level: Math.max(1, persisted?.liftLevel ?? 1),
        cargo: 0,
        task: null,
      },
      hub: {
        level: Math.max(1, persisted?.hubLevel ?? 1),
        cargo: 0,
        task: null,
      },
      managers,
      barrier: {
        maxAccessibleDepth: Math.min(SHAFT_COUNT, Math.max(INITIAL_ACCESSIBLE_DEPTH, persisted?.maxAccessibleDepth ?? inferredAccessibleDepth)),
        remaining: Math.max(0, persisted?.barrierRemaining ?? 0),
      },
      totalOreMined: Math.max(0, persisted?.totalOreMined ?? 0),
      totalCashEarned: Math.max(0, persisted?.totalCashEarned ?? 0),
    };
  }

  getState(): MineState {
    return cloneState(this.state);
  }

  getSnapshot(): MineState {
    return this.getState();
  }

  /**
   * Stage 6: все шахты одного сектора используют общий кошелек.
   * Сцена синхронизирует его с активной симуляцией через эти методы.
   */
  getCash(): number {
    return this.state.cash;
  }

  setCash(value: number): void {
    this.state.cash = Math.max(0, Number.isFinite(value) ? value : 0);
  }

  serialize(): PersistentMineState {
    const shaftLevels: Partial<Record<ShaftId, number>> = {};
    const shaftBuffers: Partial<Record<ShaftId, number>> = {};
    const unlockedShafts: ShaftId[] = [];
    const managers: NonNullable<PersistentMineState['managers']> = {};

    for (const shaft of this.state.shafts) {
      if (shaft.unlocked || shaft.level > 1 || shaft.buffer > EPSILON) {
        shaftLevels[shaft.id] = shaft.level;
        shaftBuffers[shaft.id] = shaft.buffer;
      }
      if (shaft.unlocked) unlockedShafts.push(shaft.id);
    }

    for (const id of allFacilityIds()) {
      const manager = this.state.managers[id];
      if (!manager) continue;
      if (manager.hired || manager.activeRemaining > EPSILON || manager.cooldownRemaining > EPSILON) {
        managers[id] = {
          hired: manager.hired,
          activeRemaining: manager.activeRemaining,
          cooldownRemaining: manager.cooldownRemaining,
        };
      }
    }

    return {
      rebuildLevel: this.state.rebuildLevel,
      rebuildCycleCashEarned: this.state.rebuildCycleCashEarned,
      cash: this.state.cash,
      surfaceBuffer: this.state.surfaceBuffer,
      shaftLevels,
      shaftBuffers,
      unlockedShafts,
      maxAccessibleDepth: this.state.barrier.maxAccessibleDepth,
      barrierRemaining: this.state.barrier.remaining,
      liftLevel: this.state.lift.level,
      hubLevel: this.state.hub.level,
      managers,
      totalOreMined: this.state.totalOreMined,
      totalCashEarned: this.state.totalCashEarned,
    };
  }

  getUnlockedShaftCount(): number {
    return this.state.shafts.filter((shaft) => shaft.unlocked).length;
  }

  getAccessibleShaftCount(): number {
    return this.state.barrier.maxAccessibleDepth;
  }

  getOfflineIncomePerSecond(): number {
    const automatedShafts = this.state.shafts.filter((shaft) => shaft.unlocked && this.state.managers[shaft.id]?.hired);
    const shaftThroughput = automatedShafts.reduce((sum, shaft) => {
      return sum + this.getShaftYield(shaft) / this.getShaftDuration(shaft);
    }, 0);

    if (shaftThroughput <= EPSILON || !this.state.managers.lift.hired || !this.state.managers.hub.hired) return 0;

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
      this.state.rebuildCycleCashEarned += rewardCash;
      this.state.totalOreMined += processedOre;
    }

    for (const id of allFacilityIds()) {
      const manager = this.state.managers[id];
      if (!manager) continue;
      manager.activeRemaining = Math.max(0, manager.activeRemaining - safeRawSeconds);
      manager.cooldownRemaining = Math.max(0, manager.cooldownRemaining - safeRawSeconds);
    }

    // Расчистка барьера идёт по реальному времени и не ограничивается лимитом idle-дохода.
    this.advanceBarrier(safeRawSeconds);

    const automatedShafts = this.state.shafts.filter((shaft) => shaft.unlocked && this.state.managers[shaft.id]?.hired).length;
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

  getRebuildView(): RebuildView {
    const nextTier = getNextRebuildTier(this.state.rebuildLevel);
    const unlockedDecks = this.getUnlockedShaftCount();
    const requiredRevenue = getRebuildRevenueRequirement(this.state.rebuildLevel, this.tuning.resourcePrice);
    const requiredDecks = nextTier?.requiredDecks ?? SHAFT_COUNT;
    const maxed = nextTier === null;
    return {
      level: this.state.rebuildLevel,
      maxLevel: STAGE_ONE_BALANCE.rebuild.tiers.length,
      currentMultiplier: this.state.rebuildMultiplier,
      nextMultiplier: nextTier?.multiplier ?? null,
      requiredDecks,
      unlockedDecks,
      requiredRevenue,
      cycleEarned: this.state.rebuildCycleCashEarned,
      deckProgress: maxed ? 1 : Math.min(1, unlockedDecks / Math.max(1, requiredDecks)),
      revenueProgress: maxed ? 1 : Math.min(1, this.state.rebuildCycleCashEarned / Math.max(1, requiredRevenue)),
      canRebuild: !maxed && unlockedDecks >= requiredDecks && this.state.rebuildCycleCashEarned + EPSILON >= requiredRevenue,
      maxed,
    };
  }

  performRebuild(): boolean {
    const view = this.getRebuildView();
    if (!view.canRebuild || view.maxed) return false;

    const nextLevel = this.state.rebuildLevel + 1;
    const preservedCash = this.state.cash;
    const preservedLifetimeCash = this.state.totalCashEarned;
    const preservedLifetimeOre = this.state.totalOreMined;

    for (const shaft of this.state.shafts) {
      shaft.level = 1;
      shaft.buffer = 0;
      shaft.unlocked = shaft.depth <= INITIAL_UNLOCKED_DEPTH;
      shaft.task = null;
    }

    this.state.surfaceBuffer = 0;
    this.state.lift.level = 1;
    this.state.lift.cargo = 0;
    this.state.lift.task = null;
    this.state.hub.level = 1;
    this.state.hub.cargo = 0;
    this.state.hub.task = null;
    this.state.barrier.maxAccessibleDepth = INITIAL_ACCESSIBLE_DEPTH;
    this.state.barrier.remaining = 0;

    for (const id of allFacilityIds()) {
      const manager = this.state.managers[id];
      if (!manager) continue;
      manager.hired = false;
      manager.activeRemaining = 0;
      manager.cooldownRemaining = 0;
    }

    this.state.cash = preservedCash;
    this.state.totalCashEarned = preservedLifetimeCash;
    this.state.rebuildCycleCashEarned = 0;
    this.state.totalOreMined = preservedLifetimeOre;
    this.state.rebuildLevel = nextLevel;
    this.state.rebuildMultiplier = getRebuildMultiplier(nextLevel);
    this.state.resourcePrice = this.tuning.resourcePrice * this.state.rebuildMultiplier;
    return true;
  }

  startMining(id: ShaftId): boolean {
    const shaft = this.getShaft(id);
    if (!shaft?.unlocked || shaft.task) return false;

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
      .filter((shaft) => shaft.unlocked)
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

  unlockShaft(id: ShaftId): boolean {
    const shaft = this.getShaft(id);
    if (!shaft || shaft.unlocked || shaft.depth > this.state.barrier.maxAccessibleDepth) return false;

    if (shaft.depth > 1) {
      const previous = this.getShaft(makeShaftId(shaft.depth - 1));
      if (!previous?.unlocked) return false;
    }

    const cost = getShaftUnlockCost(shaft.depth);
    if (this.state.cash + EPSILON < cost) return false;

    this.state.cash -= cost;
    shaft.unlocked = true;
    return true;
  }

  canUnlockShaft(id: ShaftId): boolean {
    const shaft = this.getShaft(id);
    if (!shaft || shaft.unlocked || shaft.depth > this.state.barrier.maxAccessibleDepth) return false;
    if (shaft.depth > 1 && !this.getShaft(makeShaftId(shaft.depth - 1))?.unlocked) return false;
    return this.state.cash + EPSILON >= getShaftUnlockCost(shaft.depth);
  }

  startBarrier(): boolean {
    const barrier = this.getCurrentBarrierView();
    if (!barrier || !barrier.canStart) return false;

    this.state.cash -= barrier.cost;
    this.state.barrier.remaining = barrier.duration;
    return true;
  }

  getCurrentBarrierView(): BarrierView | null {
    const boundaryDepth = this.state.barrier.maxAccessibleDepth;
    if (boundaryDepth >= SHAFT_COUNT) return null;

    const targetDepth = Math.min(SHAFT_COUNT, boundaryDepth + SHAFTS_PER_BARRIER);
    const cost = getBarrierCost(boundaryDepth);
    const duration = getBarrierDuration(boundaryDepth);
    const requirementsMet = Boolean(this.getShaft(makeShaftId(boundaryDepth))?.unlocked);
    const active = this.state.barrier.remaining > EPSILON;

    return {
      boundaryDepth,
      targetDepth,
      cost,
      duration,
      remaining: this.state.barrier.remaining,
      active,
      cleared: false,
      requirementsMet,
      canStart: !active && requirementsMet && this.state.cash + EPSILON >= cost,
    };
  }

  getBarrierViews(): BarrierView[] {
    const views: BarrierView[] = [];
    for (let boundary = SHAFTS_PER_BARRIER; boundary < SHAFT_COUNT; boundary += SHAFTS_PER_BARRIER) {
      const targetDepth = boundary + SHAFTS_PER_BARRIER;
      const cleared = this.state.barrier.maxAccessibleDepth > boundary;
      const current = this.state.barrier.maxAccessibleDepth === boundary;
      const requirementsMet = Boolean(this.getShaft(makeShaftId(boundary))?.unlocked);
      const cost = getBarrierCost(boundary);
      const duration = getBarrierDuration(boundary);
      views.push({
        boundaryDepth: boundary,
        targetDepth,
        cost,
        duration,
        remaining: current ? this.state.barrier.remaining : 0,
        active: current && this.state.barrier.remaining > EPSILON,
        cleared,
        requirementsMet,
        canStart: current && this.state.barrier.remaining <= EPSILON && requirementsMet && this.state.cash + EPSILON >= cost,
      });
    }
    return views;
  }

  hireManager(id: FacilityId): boolean {
    if (isShaftId(id) && !this.getShaft(id)?.unlocked) return false;

    const manager = this.state.managers[id];
    if (!manager) return false;
    const config = getManagerConfig(id);
    if (manager.hired || this.state.cash + EPSILON < config.hireCost) return false;

    this.state.cash -= config.hireCost;
    manager.hired = true;
    return true;
  }

  activateManagerAbility(id: FacilityId): boolean {
    if (isShaftId(id) && !this.getShaft(id)?.unlocked) return false;

    const manager = this.state.managers[id];
    if (!manager) return false;
    const config = getManagerConfig(id);
    if (!manager.hired || manager.cooldownRemaining > EPSILON || manager.activeRemaining > EPSILON) return false;

    manager.activeRemaining = config.abilityDuration;
    manager.cooldownRemaining = config.abilityCooldown;
    return true;
  }

  tick(deltaSeconds: number): void {
    const delta = Math.min(Math.max(deltaSeconds, 0), 0.25);
    this.advanceBarrier(delta);
    this.ensureAutomation();

    for (const shaft of this.state.shafts) {
      if (!shaft.unlocked || !shaft.task) continue;
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
        if (shaft?.unlocked) {
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
        this.state.rebuildCycleCashEarned += revenue;
        this.state.hub.cargo = 0;
        this.state.hub.task = null;
      }
    }

    for (const id of allFacilityIds()) {
      const manager = this.state.managers[id];
      if (!manager) continue;
      manager.activeRemaining = Math.max(0, manager.activeRemaining - delta);
      manager.cooldownRemaining = Math.max(0, manager.cooldownRemaining - delta);
    }

    this.ensureAutomation();
  }

  upgrade(id: FacilityId): boolean {
    return this.upgradeBulk(id, 1);
  }

  upgradeBulk(id: FacilityId, mode: BulkUpgradeMode): boolean {
    if (isShaftId(id) && !this.getShaft(id)?.unlocked) return false;

    const quote = this.getBulkUpgradeQuote(id, mode);
    if (quote.levels <= 0 || !quote.affordable) return false;

    this.state.cash -= quote.totalCost;
    this.addLevels(id, quote.levels);
    return true;
  }

  canUpgrade(id: FacilityId): boolean {
    if (isShaftId(id) && !this.getShaft(id)?.unlocked) return false;
    return this.state.cash + EPSILON >= this.getUpgradeCost(id);
  }

  getBulkUpgradeQuotes(id: FacilityId): BulkUpgradeQuotes {
    return {
      x1: this.getBulkUpgradeQuote(id, 1),
      x10: this.getBulkUpgradeQuote(id, 10),
      x25: this.getBulkUpgradeQuote(id, 25),
      max: this.getBulkUpgradeQuote(id, 'MAX'),
    };
  }

  getBulkUpgradeQuote(id: FacilityId, mode: BulkUpgradeMode): BulkUpgradeQuote {
    if (isShaftId(id) && !this.getShaft(id)?.unlocked) {
      return { mode, levels: 0, totalCost: 0, affordable: false };
    }

    const level = this.getFacilityLevel(id);
    const growth = STAGE_ONE_BALANCE.upgrades.growth;
    const firstExact = this.getUpgradeBase(id) * Math.pow(growth, level - 1);

    let levels: number;
    if (mode === 'MAX') {
      if (this.state.cash + EPSILON < firstExact) levels = 0;
      else {
        const expression = 1 + (this.state.cash * (growth - 1)) / firstExact;
        levels = Math.max(0, Math.floor(Math.log(Math.max(1, expression)) / Math.log(growth)));
        levels = Math.min(levels, 100_000);
        // Floating point correction around exact boundaries; at most a few iterations.
        while (levels > 0 && this.bulkCost(firstExact, growth, levels) > this.state.cash + EPSILON) levels -= 1;
        while (levels < 100_000 && this.bulkCost(firstExact, growth, levels + 1) <= this.state.cash + EPSILON) levels += 1;
      }
    } else {
      levels = mode;
    }

    const totalCost = levels > 0 ? this.bulkCost(firstExact, growth, levels) : 0;
    return {
      mode,
      levels,
      totalCost,
      affordable: levels > 0 && this.state.cash + EPSILON >= totalCost,
    };
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
        isUnlocked: true,
        isAccessible: true,
        unlockCost: 0,
        canUnlock: false,
        milestone: this.getMilestoneView(this.state.lift.level),
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
        isUnlocked: true,
        isAccessible: true,
        unlockCost: 0,
        canUnlock: false,
        milestone: this.getMilestoneView(this.state.hub.level),
      };
    }

    const shaft = this.getShaft(id)!;
    return {
      id,
      name: shaft.name,
      level: shaft.level,
      upgradeCost: shaft.unlocked ? this.getUpgradeCost(id) : 0,
      primaryLabel: shaft.unlocked ? 'За цикл' : 'Статус',
      primaryValue: shaft.unlocked ? `${formatCompact(this.getShaftYield(shaft))} ore` : 'ЗАБЛОКИРОВАН',
      secondaryLabel: shaft.unlocked ? 'Цикл' : 'Глубина',
      secondaryValue: shaft.unlocked ? `${this.getShaftDuration(shaft).toFixed(2)} сек` : `${shaft.depth * 100} м`,
      isUnlocked: shaft.unlocked,
      isAccessible: shaft.depth <= this.state.barrier.maxAccessibleDepth,
      unlockCost: getShaftUnlockCost(shaft.depth),
      canUnlock: this.canUnlockShaft(id),
      milestone: this.getMilestoneView(shaft.level),
    };
  }

  getManagerView(id: FacilityId): ManagerView {
    const manager = this.state.managers[id];
    const config = getManagerConfig(id);
    const facilityUnlocked = !isShaftId(id) || Boolean(this.getShaft(id)?.unlocked);
    return {
      facilityId: id,
      name: config.name,
      role: config.role,
      hired: manager?.hired ?? false,
      hireCost: config.hireCost,
      canHire: facilityUnlocked && !(manager?.hired ?? false) && this.state.cash + EPSILON >= config.hireCost,
      passiveBonusPercent: Math.round((config.passiveMultiplier - 1) * 100),
      abilityName: config.abilityName,
      abilityMultiplier: config.abilityMultiplier,
      abilityDuration: config.abilityDuration,
      activeRemaining: manager?.activeRemaining ?? 0,
      cooldownRemaining: manager?.cooldownRemaining ?? 0,
      abilityReady: facilityUnlocked && Boolean(manager?.hired) && (manager?.cooldownRemaining ?? 0) <= EPSILON && (manager?.activeRemaining ?? 0) <= EPSILON,
    };
  }

  getManagerRoster(): ManagerView[] {
    const unlockedShaftIds = this.state.shafts.filter((shaft) => shaft.unlocked).map((shaft) => shaft.id);
    return [...unlockedShaftIds, 'lift' as const, 'hub' as const].map((id) => this.getManagerView(id));
  }

  getUpgradeCost(id: FacilityId): number {
    const level = this.getFacilityLevel(id);
    return Math.floor(this.getUpgradeBase(id) * Math.pow(STAGE_ONE_BALANCE.upgrades.growth, level - 1));
  }

  getBottleneckView(): BottleneckView {
    const shaftOrePerSecond = this.state.shafts
      .filter((shaft) => shaft.unlocked)
      .reduce((sum, shaft) => sum + this.getShaftYield(shaft) / this.getShaftDuration(shaft), 0);
    const liftOrePerSecond = this.getLiftCapacity(this.state.lift) / this.getLiftDuration(this.state.lift);
    const hubOrePerSecond = this.getHubCapacity(this.state.hub) / this.getHubDuration(this.state.hub);
    const effectiveOrePerSecond = Math.min(shaftOrePerSecond, liftOrePerSecond, hubOrePerSecond);

    let bottleneck: BottleneckKind = 'shafts';
    let label = 'Добыча';
    if (liftOrePerSecond <= shaftOrePerSecond + EPSILON && liftOrePerSecond <= hubOrePerSecond + EPSILON) {
      bottleneck = 'lift';
      label = 'Cargo Lift';
    } else if (hubOrePerSecond <= shaftOrePerSecond + EPSILON && hubOrePerSecond <= liftOrePerSecond + EPSILON) {
      bottleneck = 'hub';
      label = 'Logistics';
    }

    return {
      shaftOrePerSecond,
      liftOrePerSecond,
      hubOrePerSecond,
      effectiveOrePerSecond,
      incomePerSecond: effectiveOrePerSecond * this.state.resourcePrice,
      bottleneck,
      label,
    };
  }

  getShaftYield(shaft: ShaftState): number {
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.shaftYieldPerLevel * (shaft.level - 1);
    const milestoneMultiplier = this.getMilestoneMultiplier(shaft.level);
    return Math.max(1, Math.round(shaft.baseYield * levelMultiplier * milestoneMultiplier * this.getPassiveMultiplier(shaft.id)));
  }

  getShaftDuration(shaft: ShaftState): number {
    return this.applySpeedUpgrade(shaft.baseDuration, shaft.level);
  }

  getLiftCapacity(lift: LiftState): number {
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.liftCapacityPerLevel * (lift.level - 1);
    return Math.max(1, Math.floor(
      STAGE_ONE_BALANCE.lift.baseCapacity * this.tuning.liftCapacityMultiplier * levelMultiplier * this.getMilestoneMultiplier(lift.level) * this.getPassiveMultiplier('lift'),
    ));
  }

  getLiftDuration(lift: LiftState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.lift.baseDuration, lift.level);
  }

  getHubCapacity(hub: HubState): number {
    const levelMultiplier = 1 + STAGE_ONE_BALANCE.upgrades.hubCapacityPerLevel * (hub.level - 1);
    return Math.max(1, Math.floor(
      STAGE_ONE_BALANCE.hub.baseCapacity * this.tuning.hubCapacityMultiplier * levelMultiplier * this.getMilestoneMultiplier(hub.level) * this.getPassiveMultiplier('hub'),
    ));
  }

  getHubDuration(hub: HubState): number {
    return this.applySpeedUpgrade(STAGE_ONE_BALANCE.hub.baseDuration, hub.level);
  }

  private getUpgradeBase(id: FacilityId): number {
    if (id === 'lift') return STAGE_ONE_BALANCE.upgrades.liftBaseCost;
    if (id === 'hub') return STAGE_ONE_BALANCE.upgrades.hubBaseCost;
    const depth = getShaftDepth(id);
    return STAGE_ONE_BALANCE.upgrades.shaftBaseCost * Math.pow(STAGE_ONE_BALANCE.upgrades.shaftDepthCostGrowth, depth - 1);
  }

  private getFacilityLevel(id: FacilityId): number {
    if (id === 'lift') return this.state.lift.level;
    if (id === 'hub') return this.state.hub.level;
    return this.getShaft(id)?.level ?? 1;
  }

  private addLevels(id: FacilityId, levels: number): void {
    if (id === 'lift') {
      this.state.lift.level += levels;
      return;
    }
    if (id === 'hub') {
      this.state.hub.level += levels;
      return;
    }
    const shaft = this.getShaft(id);
    if (shaft?.unlocked) shaft.level += levels;
  }

  private bulkCost(firstCost: number, growth: number, levels: number): number {
    if (levels <= 0) return 0;
    if (Math.abs(growth - 1) < EPSILON) return Math.floor(firstCost * levels);
    return Math.floor(firstCost * ((Math.pow(growth, levels) - 1) / (growth - 1)));
  }

  private getMilestoneMultiplier(level: number): number {
    return STAGE_ONE_BALANCE.upgrades.milestones.reduce((multiplier, milestone) => {
      return level >= milestone.level ? multiplier * milestone.multiplier : multiplier;
    }, 1);
  }

  private getMilestoneView(level: number) {
    const currentMultiplier = this.getMilestoneMultiplier(level);
    const next = STAGE_ONE_BALANCE.upgrades.milestones.find((milestone) => milestone.level > level);
    return {
      currentMultiplier,
      nextLevel: next?.level ?? null,
      nextMultiplier: next?.multiplier ?? null,
    };
  }

  private getPassiveMultiplier(id: FacilityId): number {
    return this.state.managers[id]?.hired ? getManagerConfig(id).passiveMultiplier : 1;
  }

  private getTaskSpeedMultiplier(id: FacilityId): number {
    const manager = this.state.managers[id];
    if (!manager?.hired || manager.activeRemaining <= EPSILON) return 1;
    return getManagerConfig(id).abilityMultiplier;
  }

  private ensureAutomation(): void {
    for (const shaft of this.state.shafts) {
      if (shaft.unlocked && this.state.managers[shaft.id]?.hired && !shaft.task) this.startMining(shaft.id);
    }

    if (this.state.managers.lift.hired && !this.state.lift.task) this.startLift();
    if (this.state.managers.hub.hired && !this.state.hub.task) this.startHub();
  }

  private applySpeedUpgrade(baseDuration: number, level: number): number {
    const reduction = Math.min(
      STAGE_ONE_BALANCE.upgrades.maxSpeedReduction,
      STAGE_ONE_BALANCE.upgrades.speedPerLevel * (level - 1),
    );
    return Math.max(0.25, baseDuration * (1 - reduction));
  }

  private advanceBarrier(seconds: number): void {
    if (this.state.barrier.remaining <= EPSILON || seconds <= 0) return;
    this.state.barrier.remaining = Math.max(0, this.state.barrier.remaining - seconds);
    if (this.state.barrier.remaining <= EPSILON) {
      this.state.barrier.maxAccessibleDepth = Math.min(SHAFT_COUNT, this.state.barrier.maxAccessibleDepth + SHAFTS_PER_BARRIER);
      this.state.barrier.remaining = 0;
    }
  }

  private getShaft(id: ShaftId): ShaftState | undefined {
    return this.state.shafts.find((shaft) => shaft.id === id);
  }
}
