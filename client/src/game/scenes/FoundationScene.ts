import Phaser from 'phaser';
import { loadGameState, saveGameState } from '../../db/saveRepository';
import { useGameStore } from '../../state/gameStore';
import { makeShaftId, SHAFT_COUNT, SHAFTS_PER_BARRIER, STAGE_ONE_BALANCE } from '../core/balance';
import { formatCompact } from '../core/format';
import { MineSimulation } from '../core/MineSimulation';
import {
  DEFAULT_ACADEMY_STATE,
  buildAcademyView,
  claimAcademyOperation,
  runAcademyRecruitScan,
  sanitizeAcademyState,
  spendPromotionBadges,
  spendTrainingModules,
  startAcademyOperation,
  type PersistentAcademyState,
} from '../core/academy';
import {
  DEFAULT_RESEARCH_STATE,
  RESEARCH_NODES,
  canPurchaseResearchNode,
  getRebuildResearchReward,
  getResearchModifiers,
  getResearchRespecQuote,
  getResearchSpentCores,
  purchaseResearchNode,
  respecResearch,
  sanitizeResearchState,
  type PersistentResearchState,
} from '../core/research';
import type { FacilityId, MineId, OfflineProgressReport, PersistentMineState, ResearchView, SectorId, ShaftId, WorldMineView, WorldSectorView } from '../core/types';
import {
  DEFAULT_SPECIALIST_SYSTEM,
  activateSpecialist,
  advanceSpecialistTimers,
  assignSpecialist,
  buildSpecialistSystemView,
  getSpecialistModifiers,
  getSpecialistPromotionCost,
  getSpecialistTrainingCost,
  getTotalRebuilds,
  grantSpecialistFragments,
  promoteSpecialist,
  rankUpSpecialist,
  recruitSpecialist,
  sanitizeSpecialistSystem,
  trainSpecialist,
  unassignSpecialist,
  type PersistentSpecialistSystem,
  getSpecialistDefinition,
} from '../core/specialists';
import {
  DEFAULT_EQUIPMENT_STATE,
  buildEquipmentView,
  craftEquipment,
  equipSpecialist,
  grantCraftMaterials,
  sanitizeEquipmentState,
  unequipSpecialist,
  type PersistentEquipmentState,
} from '../core/equipment';
import {
  DEFAULT_COLLECTION_STATE,
  buildCollectionView,
  getCollectionModifiers,
  getCollectionVisualPalette,
  getTotalCollectionLevels,
  grantSupplyKeys,
  openSupplyCrate,
  sanitizeCollectionState,
  selectCollectionCard,
  type CollectionCardId,
  type PersistentCollectionState,
} from '../core/collection';
import {
  DEFAULT_RELIC_STATE,
  buildRelicView,
  evaluateRelics,
  getRelicModifiers,
  sanitizeRelicState,
  type PersistentRelicState,
} from '../core/relics';
import { DEFAULT_MINE_ID, DEFAULT_SECTOR_ID, getFirstMineId, getMineDefinition, getSectorDefinition, WORLD_MINES, WORLD_SECTORS } from '../core/worldConfig';
import {
  advanceWeeklyContract,
  buildWeeklyContractView,
  claimWeeklyContractMilestone,
  createWeeklyContractState,
  hireWeeklyContractManager,
  runWeeklyContractManualShift,
  sanitizeWeeklyContractState,
  upgradeWeeklyContractFacility,
  type PersistentWeeklyContractState,
} from '../core/weeklyContract';
import { getServerClock } from '../../services/serverClock';
import { onGameCommand, type GameCommand } from '../runtime/gameRuntime';

interface ShaftVisual {
  bg: Phaser.GameObjects.Rectangle;
  floor: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  buffer: Phaser.GameObjects.Text;
  workerBody: Phaser.GameObjects.Rectangle;
  workerHead: Phaser.GameObjects.Arc;
  ore: Phaser.GameObjects.Arc;
  progressBg: Phaser.GameObjects.Rectangle;
  progressFill: Phaser.GameObjects.Rectangle;
  runButton: Phaser.GameObjects.Rectangle;
  runText: Phaser.GameObjects.Text;
  autoBadge: Phaser.GameObjects.Text;
}

interface BarrierVisual {
  bg: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Rectangle;
  buttonText: Phaser.GameObjects.Text;
}

export class FoundationScene extends Phaser.Scene {
  private activeMineId: MineId = DEFAULT_MINE_ID;
  private unlockedSectors = new Set<SectorId>([DEFAULT_SECTOR_ID]);
  private sectorWallets: Partial<Record<SectorId, number>> = { [DEFAULT_SECTOR_ID]: 0 };
  private unlockedMines = new Set<MineId>([DEFAULT_MINE_ID]);
  private mineStates: Partial<Record<MineId, PersistentMineState>> = {};
  private lastSimulatedAt: Partial<Record<MineId, number>> = {};
  private research: PersistentResearchState = { ...DEFAULT_RESEARCH_STATE };
  private specialists: PersistentSpecialistSystem = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
  private academy: PersistentAcademyState = sanitizeAcademyState(DEFAULT_ACADEMY_STATE);
  private equipment: PersistentEquipmentState = sanitizeEquipmentState(DEFAULT_EQUIPMENT_STATE);
  private collection: PersistentCollectionState = sanitizeCollectionState(DEFAULT_COLLECTION_STATE);
  private relics: PersistentRelicState = sanitizeRelicState(DEFAULT_RELIC_STATE);
  private weeklyContract: PersistentWeeklyContractState = createWeeklyContractState(Date.now());
  private lastCollectionCrate: CollectionCardId[] = [];
  private relicContextKey = '';
  private totalRebuildCache: number | null = null;
  private simulation = new MineSimulation(undefined, getMineDefinition(DEFAULT_MINE_ID).tuning, getResearchModifiers([]));
  private selectedFacility: FacilityId = 'shaft-1';
  private shaftVisuals = new Map<ShaftId, ShaftVisual>();
  private barrierVisuals = new Map<number, BarrierVisual>();
  private surface?: Phaser.GameObjects.Rectangle;
  private mine?: Phaser.GameObjects.Rectangle;
  private liftRail?: Phaser.GameObjects.Rectangle;
  private liftCage?: Phaser.GameObjects.Rectangle;
  private liftLabel?: Phaser.GameObjects.Text;
  private liftCargo?: Phaser.GameObjects.Text;
  private liftAutoText?: Phaser.GameObjects.Text;
  private hubBuilding?: Phaser.GameObjects.Rectangle;
  private hubTruck?: Phaser.GameObjects.Rectangle;
  private hubLabel?: Phaser.GameObjects.Text;
  private hubAutoText?: Phaser.GameObjects.Text;
  private surfaceBufferText?: Phaser.GameObjects.Text;
  private hint?: Phaser.GameObjects.Text;
  private depthText?: Phaser.GameObjects.Text;
  private syncAccumulator = 0;
  private uiSyncInterval = 140;
  private unsubscribeCommands?: () => void;
  private saveCreatedAt = Date.now();
  private persistenceReady = false;
  private hiddenAt: number | null = null;
  private surfaceHeight = 126;
  private rowHeight = 124;
  private barrierGap = 62;
  private worldHeight = 4200;
  private dragStartY = 0;
  private dragStartScrollY = 0;
  private dragging = false;
  private worldViewsCache: WorldMineView[] = [];
  private sectorViewsCache: WorldSectorView[] = [];
  private worldViewsCacheAt = 0;
  private sectorViewsCacheAt = 0;
  private beforeUnloadHandler = () => { void this.persist(); };
  private visibilityHandler = () => { void this.handleVisibilityChange(); };

  constructor() {
    super('FoundationScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#101318');
    const quality = useGameStore.getState().quality;
    this.uiSyncInterval = quality === 'LOW' ? 250 : quality === 'MEDIUM' ? 160 : 120;

    this.createEnvironment();
    this.createShaftVisuals();
    this.createBarrierVisuals();
    this.createLiftVisuals();
    this.createHubVisuals();
    this.applyCollectionVisuals();
    this.createScrollInput();

    this.unsubscribeCommands = onGameCommand((command) => this.handleCommand(command));
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.scale.on('resize', this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => { void this.persist(); },
    });

    this.layout({ width: this.scale.width, height: this.scale.height } as Phaser.Structs.Size);
    this.syncUi();
    void this.restore();
  }

  update(_time: number, deltaMs: number) {
    if (document.visibilityState === 'hidden') return;

    const deltaSeconds = deltaMs / 1000;
    advanceSpecialistTimers(this.specialists, deltaSeconds);
    this.applySpecialistsToActiveSimulation();
    this.simulation.tick(deltaSeconds);
    this.renderSimulation();

    this.syncAccumulator += deltaMs;
    if (this.syncAccumulator >= this.uiSyncInterval) {
      this.syncAccumulator = 0;
      this.syncUi();
    }
  }

  private createEnvironment() {
    this.mine = this.add.rectangle(0, 0, 100, 100, 0x171b20).setOrigin(0.5).setDepth(-3);
    this.surface = this.add.rectangle(0, 0, 100, 100, 0x29333a).setOrigin(0.5).setDepth(-2);

    this.hint = this.add.text(0, 0, 'ПРОКРУЧИВАЙ ШАХТУ ВНИЗ · КАЖДЫЕ 5 УРОВНЕЙ — БАРЬЕР', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#b9c5cc',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.depthText = this.add.text(0, 0, 'DEPTH 0 m', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#697680', fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private createShaftVisuals() {
    for (let depth = 1; depth <= SHAFT_COUNT; depth += 1) {
      const id = makeShaftId(depth);
      const bg = this.add.rectangle(0, 0, 100, 84, 0x20262c)
        .setStrokeStyle(2, 0x39424b, 1);
      const floor = this.add.rectangle(0, 0, 100, 4, 0x59636c);
      const title = this.add.text(0, 0, `DECK ${String(depth).padStart(2, '0')}`, {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#f2f5f7', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      const buffer = this.add.text(0, 0, '0 ore', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#f0b429', fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      const workerBody = this.add.rectangle(0, 0, 10, 18, 0xd17c35).setOrigin(0.5, 0.5);
      const workerHead = this.add.circle(0, 0, 5, 0xe2b58b);
      const ore = this.add.circle(0, 0, 5, 0xf0b429).setVisible(false);
      const progressBg = this.add.rectangle(0, 0, 100, 5, 0x0f1216).setOrigin(0, 0.5);
      const progressFill = this.add.rectangle(0, 0, 1, 5, 0xf0b429).setOrigin(0, 0.5);
      const runButton = this.add.rectangle(0, 0, 74, 34, 0x313a42)
        .setStrokeStyle(1, 0x66727c, 1)
        .setInteractive({ useHandCursor: true });
      const runText = this.add.text(0, 0, '▶', {
        fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const autoBadge = this.add.text(0, 0, 'AUTO', {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#9ff0bd', fontStyle: 'bold',
        backgroundColor: '#173326', padding: { x: 5, y: 3 },
      }).setOrigin(0, 0.5).setVisible(false);

      title.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (Math.abs(pointer.y - pointer.downY) > 12) return;
        this.selectFacility(id);
      });
      runButton.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (Math.abs(pointer.y - pointer.downY) > 12) return;
        const stats = this.simulation.getFacilityStats(id);
        this.selectFacility(id);
        if (!stats.isUnlocked) this.simulation.unlockShaft(id);
        else this.simulation.startMining(id);
        this.syncUi();
        void this.persist();
      });

      this.shaftVisuals.set(id, {
        bg, floor, title, buffer, workerBody, workerHead, ore, progressBg, progressFill, runButton, runText, autoBadge,
      });
    }
  }

  private createBarrierVisuals() {
    for (let boundary = SHAFTS_PER_BARRIER; boundary < SHAFT_COUNT; boundary += SHAFTS_PER_BARRIER) {
      const bg = this.add.rectangle(0, 0, 100, 46, 0x241f15)
        .setStrokeStyle(1, 0x6f5925, 1);
      const title = this.add.text(0, 0, `ROCK BARRIER · ${boundary}00 m`, {
        fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#e7c56e', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const subtitle = this.add.text(0, 0, 'LOCKED', {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#887b5a', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const button = this.add.rectangle(0, 0, 86, 30, 0x6c531e)
        .setStrokeStyle(1, 0xa98531, 1)
        .setInteractive({ useHandCursor: true });
      const buttonText = this.add.text(0, 0, 'CLEAR', {
        fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#fff1c2', fontStyle: 'bold',
      }).setOrigin(0.5);

      button.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (Math.abs(pointer.y - pointer.downY) > 12) return;
        const current = this.simulation.getCurrentBarrierView();
        if (current?.boundaryDepth !== boundary) return;
        this.simulation.startBarrier();
        this.syncUi();
        this.renderSimulation();
        void this.persist();
      });

      this.barrierVisuals.set(boundary, { bg, title, subtitle, button, buttonText });
    }
  }

  private createLiftVisuals() {
    this.liftRail = this.add.rectangle(0, 0, 30, 100, 0x0c0f12)
      .setStrokeStyle(2, 0x77828b, 1)
      .setInteractive({ useHandCursor: true });
    this.liftCage = this.add.rectangle(0, 0, 28, 36, 0xf0b429)
      .setStrokeStyle(2, 0xffdd73, 1)
      .setInteractive({ useHandCursor: true });
    this.liftLabel = this.add.text(0, 0, 'LIFT', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#101318', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.liftCargo = this.add.text(0, 0, '0', {
      fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#101318', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.liftAutoText = this.add.text(0, 0, 'AUTO', {
      fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#9ff0bd', fontStyle: 'bold',
      backgroundColor: '#173326', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setVisible(false);

    const activate = (pointer: Phaser.Input.Pointer) => {
      if (Math.abs(pointer.y - pointer.downY) > 12) return;
      this.selectFacility('lift');
      this.simulation.startLift();
    };
    this.liftRail?.on('pointerup', activate);
    this.liftCage?.on('pointerup', activate);
  }

  private createHubVisuals() {
    this.hubBuilding = this.add.rectangle(0, 0, 84, 48, 0x36515b)
      .setStrokeStyle(2, 0x6f8b94, 1)
      .setInteractive({ useHandCursor: true });
    this.hubTruck = this.add.rectangle(0, 0, 58, 24, 0xcc5d46)
      .setStrokeStyle(2, 0xff8f76, 1)
      .setInteractive({ useHandCursor: true });
    this.hubLabel = this.add.text(0, 0, 'LOGISTICS', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#f5f7fa', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hubAutoText = this.add.text(0, 0, 'AUTO', {
      fontFamily: 'Arial, sans-serif', fontSize: '8px', color: '#9ff0bd', fontStyle: 'bold',
      backgroundColor: '#173326', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    this.surfaceBufferText = this.add.text(0, 0, 'Surface: 0 ore', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#f0b429', fontStyle: 'bold',
    }).setOrigin(0.5);

    const activate = (pointer: Phaser.Input.Pointer) => {
      if (Math.abs(pointer.y - pointer.downY) > 12) return;
      this.selectFacility('hub');
      this.simulation.startHub();
    };
    this.hubBuilding?.on('pointerup', activate);
    this.hubTruck?.on('pointerup', activate);
  }

  private createScrollInput() {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      this.setCameraScroll(this.cameras.main.scrollY + dy * 0.8);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      this.setCameraScroll(this.dragStartScrollY + (this.dragStartY - pointer.y));
    });

    this.input.on('pointerup', () => { this.dragging = false; });
    this.input.on('pointerupoutside', () => { this.dragging = false; });
  }

  private handleCommand(command: GameCommand) {
    switch (command.type) {
      case 'START_SHAFT':
        this.selectFacility(command.shaftId);
        this.simulation.startMining(command.shaftId);
        break;
      case 'START_LIFT':
        this.selectFacility('lift');
        this.simulation.startLift();
        break;
      case 'START_HUB':
        this.selectFacility('hub');
        this.simulation.startHub();
        break;
      case 'UPGRADE':
        this.selectFacility(command.facilityId);
        this.simulation.upgrade(command.facilityId);
        this.syncUi();
        void this.persist();
        break;
      case 'UPGRADE_BULK':
        this.selectFacility(command.facilityId);
        this.simulation.upgradeBulk(command.facilityId, command.mode);
        this.syncUi();
        void this.persist();
        break;
      case 'UNLOCK_SHAFT':
        this.selectFacility(command.shaftId);
        this.simulation.unlockShaft(command.shaftId);
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      case 'START_BARRIER':
        this.simulation.startBarrier();
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      case 'HIRE_MANAGER':
        this.selectFacility(command.facilityId);
        this.simulation.hireManager(command.facilityId);
        this.syncUi();
        void this.persist();
        break;
      case 'ACTIVATE_MANAGER':
        this.selectFacility(command.facilityId);
        this.simulation.activateManagerAbility(command.facilityId);
        this.syncUi();
        void this.persist();
        break;
      case 'SELECT':
        this.selectFacility(command.facilityId, true);
        break;
      case 'OPEN_MINE':
        void this.openMine(command.mineId);
        break;
      case 'UNLOCK_MINE':
        this.unlockMine(command.mineId);
        break;
      case 'UNLOCK_SECTOR':
        this.unlockSector(command.sectorId);
        break;
      case 'REBUILD_MINE': {
        const beforeLevel = this.simulation.getRebuildView().level;
        if (this.simulation.performRebuild()) {
          const newLevel = this.simulation.getRebuildView().level;
          if (newLevel > beforeLevel) {
            this.research.cores += getRebuildResearchReward(newLevel);
            this.totalRebuildCache = null;
          }
          this.selectedFacility = 'shaft-1';
          this.worldViewsCacheAt = 0;
          this.sectorViewsCacheAt = 0;
          this.mineStates[this.activeMineId] = this.serializeMine(this.simulation);
          this.lastSimulatedAt[this.activeMineId] = Date.now();
          this.setCameraScroll(0);
          this.syncUi();
          this.renderSimulation();
          void this.persist();
        }
        break;
      }
      case 'RESEARCH_BUY': {
        const next = purchaseResearchNode(command.nodeId, this.research);
        if (!next) break;
        this.research = next;
        this.applyResearchToActiveSimulation();
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'RESEARCH_RESET': {
        const next = respecResearch(this.research);
        if (!next) break;
        this.research = next;
        this.applyResearchToActiveSimulation();
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_ASSIGN': {
        const next = assignSpecialist(this.specialists, command.specialistId, this.activeMineId, command.slot, this.getTotalRebuildCount());
        if (!next) break;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_UNASSIGN': {
        this.specialists = unassignSpecialist(this.specialists, this.activeMineId, command.slot);
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_ACTIVATE': {
        const research = getResearchModifiers(this.research.purchased);
        const next = activateSpecialist(this.specialists, command.specialistId, this.activeMineId, this.getTotalRebuildCount(), research.specialistCooldownMultiplier, this.equipment);
        if (!next) break;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_TRAIN': {
        const profile = this.specialists.profiles[command.specialistId];
        const level = Math.max(1, profile?.level ?? 1);
        const cost = getSpecialistTrainingCost(command.specialistId, level);
        const academy = spendTrainingModules(this.academy, cost);
        if (!academy) break;
        const next = trainSpecialist(this.specialists, command.specialistId, this.getTotalRebuildCount());
        if (!next) break;
        this.academy = academy;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_RECRUIT': {
        const next = recruitSpecialist(this.specialists, command.specialistId, this.getTotalRebuildCount());
        if (!next) break;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.syncUi();
        void this.persist();
        break;
      }
      case 'SPECIALIST_RANK_UP': {
        const next = rankUpSpecialist(this.specialists, command.specialistId);
        if (!next) break;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'SPECIALIST_PROMOTE': {
        const profile = this.specialists.profiles[command.specialistId];
        const promotionCost = getSpecialistPromotionCost(profile?.promotion ?? 0);
        if (promotionCost === null) break;
        const academy = spendPromotionBadges(this.academy, promotionCost);
        if (!academy) break;
        const next = promoteSpecialist(this.specialists, command.specialistId);
        if (!next) break;
        this.academy = academy;
        this.specialists = next;
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'ACADEMY_START': {
        const next = startAcademyOperation(this.academy, Date.now(), this.getTotalRebuildCount());
        if (!next) break;
        this.academy = next;
        this.syncUi();
        void this.persist();
        break;
      }
      case 'ACADEMY_CLAIM': {
        const result = claimAcademyOperation(this.academy, Date.now());
        if (!result) break;
        this.academy = result.state;
        this.specialists = grantSpecialistFragments(this.specialists, result.fragments.specialistId, result.fragments.amount);
        this.equipment = grantCraftMaterials(this.equipment, { alloy: result.rewards.alloy, circuits: result.rewards.circuits, fiber: result.rewards.fiber });
        this.collection = grantSupplyKeys(this.collection, result.rewards.supplyKeys);
        this.refreshRelics();
        this.syncUi();
        void this.persist();
        break;
      }
      case 'ACADEMY_RECRUIT_SCAN': {
        const result = runAcademyRecruitScan(this.academy, Date.now());
        if (!result) break;
        this.academy = result.state;
        this.specialists = grantSpecialistFragments(this.specialists, result.fragments.specialistId, result.fragments.amount);
        this.syncUi();
        void this.persist();
        break;
      }
      case 'EQUIPMENT_CRAFT': {
        const next = craftEquipment(this.equipment, command.equipmentId);
        if (!next) break;
        this.equipment = next;
        this.refreshRelics(true);
        this.syncUi();
        void this.persist();
        break;
      }
      case 'EQUIPMENT_EQUIP': {
        const profile = this.specialists.profiles[command.specialistId];
        if (!profile?.recruited) break;
        const role = getSpecialistDefinition(command.specialistId).role;
        const next = equipSpecialist(this.equipment, command.specialistId, role, command.equipmentId);
        if (!next) break;
        this.equipment = next;
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'EQUIPMENT_UNEQUIP': {
        this.equipment = unequipSpecialist(this.equipment, command.specialistId);
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'COLLECTION_OPEN_CRATE': {
        const result = openSupplyCrate(this.collection);
        if (!result) break;
        this.collection = result.state;
        this.lastCollectionCrate = result.cards;
        this.applyCollectionVisuals();
        this.refreshRelics(true);
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
      case 'CONTRACT_MANUAL_SHIFT': {
        const clock = getServerClock();
        this.weeklyContract = advanceWeeklyContract(this.weeklyContract, clock.now);
        this.weeklyContract = runWeeklyContractManualShift(this.weeklyContract);
        this.syncUi();
        void this.persist();
        break;
      }
      case 'CONTRACT_UPGRADE': {
        const clock = getServerClock();
        this.weeklyContract = advanceWeeklyContract(this.weeklyContract, clock.now);
        const next = upgradeWeeklyContractFacility(this.weeklyContract, command.facilityId);
        if (!next) break;
        this.weeklyContract = next;
        this.syncUi();
        void this.persist();
        break;
      }
      case 'CONTRACT_HIRE_MANAGER': {
        const clock = getServerClock();
        this.weeklyContract = advanceWeeklyContract(this.weeklyContract, clock.now);
        const next = hireWeeklyContractManager(this.weeklyContract, command.facilityId);
        if (!next) break;
        this.weeklyContract = next;
        this.syncUi();
        void this.persist();
        break;
      }
      case 'CONTRACT_CLAIM_MILESTONE': {
        const clock = getServerClock();
        this.weeklyContract = advanceWeeklyContract(this.weeklyContract, clock.now);
        const result = claimWeeklyContractMilestone(this.weeklyContract, command.milestoneId);
        if (!result) break;
        this.weeklyContract = result.state;
        const reward = result.reward;
        if (reward.kind === 'research') this.research.cores += reward.amount ?? 0;
        if (reward.kind === 'recruit') this.academy = { ...this.academy, resources: { ...this.academy.resources, recruitData: this.academy.resources.recruitData + (reward.amount ?? 0) } };
        if (reward.kind === 'training') this.academy = { ...this.academy, resources: { ...this.academy.resources, trainingModules: this.academy.resources.trainingModules + (reward.amount ?? 0) } };
        if (reward.kind === 'promotion') this.academy = { ...this.academy, resources: { ...this.academy.resources, promotionBadges: this.academy.resources.promotionBadges + (reward.amount ?? 0) } };
        if (reward.kind === 'supply') this.collection = grantSupplyKeys(this.collection, reward.amount ?? 0);
        if (reward.kind === 'materials') this.equipment = grantCraftMaterials(this.equipment, { alloy: reward.alloy ?? 0, circuits: reward.circuits ?? 0, fiber: reward.fiber ?? 0 });
        this.refreshRelics(true);
        this.syncUi();
        void this.persist();
        break;
      }
      case 'COLLECTION_SELECT': {
        const next = selectCollectionCard(this.collection, command.cardId);
        if (!next) break;
        this.collection = next;
        this.applyCollectionVisuals();
        this.applySpecialistsToActiveSimulation();
        this.worldViewsCacheAt = 0;
        this.sectorViewsCacheAt = 0;
        this.syncUi();
        this.renderSimulation();
        void this.persist();
        break;
      }
    }
  }

  private createSimulation(id: MineId, state?: PersistentMineState | null, includeSpecialistActive = false): MineSimulation {
    const research = getResearchModifiers(this.research.purchased);
    return new MineSimulation(
      state,
      getMineDefinition(id).tuning,
      research,
      this.getCombinedProductionModifiers(id, includeSpecialistActive),
    );
  }

  private getResearchView(): ResearchView {
    const quote = getResearchRespecQuote(this.research);
    return {
      cores: this.research.cores,
      spentCores: getResearchSpentCores(this.research.purchased),
      purchasedCount: this.research.purchased.length,
      totalNodes: RESEARCH_NODES.length,
      respecFee: quote.fee,
      respecRefund: quote.refund,
      nodes: RESEARCH_NODES.map((node) => ({
        id: node.id,
        branch: node.branch,
        tier: node.tier,
        title: node.title,
        description: node.description,
        cost: node.cost,
        purchased: this.research.purchased.includes(node.id),
        available: canPurchaseResearchNode(node.id, this.research),
        lockedBy: node.requires.filter((id) => !this.research.purchased.includes(id)),
      })),
    };
  }

  private applyResearchToActiveSimulation() {
    this.simulation.setResearchModifiers(getResearchModifiers(this.research.purchased));
    this.applySpecialistsToActiveSimulation();
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
  }

  private getTotalRebuildCount(): number {
    if (this.totalRebuildCache !== null) return this.totalRebuildCache;
    const states = Object.entries(this.mineStates).map(([id, state]) => {
      if (id === this.activeMineId) return this.simulation.serialize();
      return state;
    });
    this.totalRebuildCache = getTotalRebuilds(states);
    return this.totalRebuildCache;
  }

  private getCombinedProductionModifiers(id: MineId, includeActive: boolean) {
    const research = getResearchModifiers(this.research.purchased);
    const specialists = getSpecialistModifiers(
      this.specialists, id, this.getTotalRebuildCount(), includeActive, research.specialistPassiveMultiplier, this.equipment,
    );
    const collection = getCollectionModifiers(this.collection);
    const relics = getRelicModifiers(this.relics);
    return {
      shaftYieldMultiplier: specialists.shaftYieldMultiplier * collection.shaftYieldMultiplier * relics.shaftYieldMultiplier,
      liftCapacityMultiplier: specialists.liftCapacityMultiplier * collection.liftCapacityMultiplier * relics.liftCapacityMultiplier,
      hubCapacityMultiplier: specialists.hubCapacityMultiplier * collection.hubCapacityMultiplier * relics.hubCapacityMultiplier,
      incomeMultiplier: specialists.incomeMultiplier * relics.incomeMultiplier,
    };
  }

  private applySpecialistsToActiveSimulation() {
    this.simulation.setSpecialistModifiers(this.getCombinedProductionModifiers(this.activeMineId, true));
  }

  private getSpecialistView() {
    const research = getResearchModifiers(this.research.purchased);
    return buildSpecialistSystemView(
      this.specialists,
      this.activeMineId,
      this.getTotalRebuildCount(),
      this.academy.resources,
      research.specialistPassiveMultiplier,
      this.equipment,
    );
  }

  private getAcademyView() {
    return buildAcademyView(this.academy, Date.now(), this.getTotalRebuildCount());
  }

  private getRecruitedSpecialistCount() {
    return Object.values(this.specialists.profiles).filter((profile) => profile?.recruited).length;
  }

  private refreshRelics(force = false) {
    const context = {
      totalRebuilds: this.getTotalRebuildCount(),
      unlockedMines: this.unlockedMines.size,
      recruitedSpecialists: this.getRecruitedSpecialistCount(),
      academyCompleted: this.academy.completedOperations,
      collectionLevels: getTotalCollectionLevels(this.collection),
      craftedEquipment: this.equipment.craftedCount,
    };
    const key = Object.values(context).join(':');
    if (!force && key === this.relicContextKey) return;
    const before = this.relics.unlocked.length;
    this.relics = evaluateRelics(this.relics, context);
    this.relicContextKey = key;
    if (this.relics.unlocked.length !== before) {
      this.applySpecialistsToActiveSimulation();
      this.worldViewsCacheAt = 0;
      this.sectorViewsCacheAt = 0;
    }
  }

  private applyCollectionVisuals() {
    const palette = getCollectionVisualPalette(this.collection);
    for (const visual of this.shaftVisuals.values()) visual.workerBody.setFillStyle(palette.workerColor);
    this.liftCage?.setFillStyle(palette.liftColor);
    this.hubTruck?.setFillStyle(palette.hubColor);
  }

  private serializeMine(simulation: MineSimulation): PersistentMineState {
    const state = simulation.serialize();
    // Начиная со Stage 6 деньги живут в кошельке сектора, а не внутри конкретной шахты.
    state.cash = 0;
    return state;
  }

  private getSectorWallet(id: SectorId): number {
    return Math.max(0, this.sectorWallets[id] ?? 0);
  }

  private setSectorWallet(id: SectorId, value: number) {
    this.sectorWallets[id] = Math.max(0, Number.isFinite(value) ? value : 0);
  }

  private addSectorWallet(id: SectorId, value: number) {
    if (value <= 0) return;
    this.setSectorWallet(id, this.getSectorWallet(id) + value);
  }

  private syncActiveWalletFromSimulation() {
    const sectorId = getMineDefinition(this.activeMineId).sectorId;
    this.setSectorWallet(sectorId, this.simulation.getCash());
  }

  private getPersistentMine(id: MineId): PersistentMineState {
    if (id === this.activeMineId) return this.serializeMine(this.simulation);
    return this.mineStates[id] ?? this.serializeMine(this.createSimulation(id));
  }

  private getSectorLifetimeEarned(id: SectorId): number {
    const definition = getSectorDefinition(id);
    return definition.mines.reduce((sum, mine) => {
      if (!this.unlockedMines.has(mine.id)) return sum;
      return sum + this.getPersistentMine(mine.id).totalCashEarned;
    }, 0);
  }

  private canUnlockSector(id: SectorId): boolean {
    const definition = getSectorDefinition(id);
    if (this.unlockedSectors.has(id)) return false;
    if (!definition.previousSectorId || !this.unlockedSectors.has(definition.previousSectorId)) return false;
    const previous = getSectorDefinition(definition.previousSectorId);
    const previousCompleted = previous.mines.every((mine) => this.unlockedMines.has(mine.id));
    if (!previousCompleted) return false;
    return this.getSectorLifetimeEarned(definition.previousSectorId) + 0.0001 >= definition.unlockEarnedRequired;
  }

  private unlockSector(id: SectorId) {
    if (!this.canUnlockSector(id)) return;
    const now = Date.now();
    const firstMineId = getFirstMineId(id);
    this.unlockedSectors.add(id);
    this.unlockedMines.add(firstMineId);
    this.setSectorWallet(id, 0);
    this.mineStates[firstMineId] = this.serializeMine(this.createSimulation(firstMineId));
    this.lastSimulatedAt[firstMineId] = now;
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
    this.syncUi();
    void this.persist();
  }

  private canUnlockMine(id: MineId): boolean {
    const definition = getMineDefinition(id);
    if (!this.unlockedSectors.has(definition.sectorId) || this.unlockedMines.has(id)) return false;
    if (!definition.previousMineId || !this.unlockedMines.has(definition.previousMineId)) return false;
    const previous = this.getPersistentMine(definition.previousMineId);
    return previous.totalCashEarned + 0.0001 >= definition.unlockEarnedRequired;
  }

  private unlockMine(id: MineId) {
    if (!this.canUnlockMine(id)) return;
    const now = Date.now();
    this.unlockedMines.add(id);
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
    this.mineStates[id] = this.serializeMine(this.createSimulation(id));
    this.lastSimulatedAt[id] = now;
    this.syncUi();
    void this.persist();
  }

  private openMine(id: MineId) {
    if (!this.unlockedMines.has(id)) return;
    const now = Date.now();

    // Фиксируем текущий объект и общий кошелек его сектора перед переключением.
    this.syncActiveWalletFromSimulation();
    this.mineStates[this.activeMineId] = this.serializeMine(this.simulation);
    this.lastSimulatedAt[this.activeMineId] = now;

    const definition = getMineDefinition(id);
    const target = this.createSimulation(id, this.mineStates[id], true);
    target.setCash(this.getSectorWallet(definition.sectorId));
    const lastAt = this.lastSimulatedAt[id] ?? now;
    const rawSeconds = Math.max(0, (now - lastAt) / 1000);
    const report = rawSeconds > 0 ? target.applyOfflineProgress(rawSeconds) : null;
    this.setSectorWallet(definition.sectorId, target.getCash());

    this.activeMineId = id;
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
    this.simulation = target;
    this.mineStates[id] = this.serializeMine(target);
    this.lastSimulatedAt[id] = now;
    this.selectedFacility = 'shaft-1';
    this.applyMineTheme();
    this.setCameraScroll(0);
    this.syncUi();
    this.renderSimulation();

    if (report && rawSeconds >= STAGE_ONE_BALANCE.idle.minimumReportSeconds) {
      useGameStore.getState().setOfflineReport({
        ...report,
        operatingMines: report.rewardCash > 0 ? 1 : 0,
        unlockedMines: this.unlockedMines.size,
        unlockedSectors: this.unlockedSectors.size,
        sectorRewards: report.rewardCash > 0 ? { [definition.sectorId]: report.rewardCash } : {},
      });
    }
    void this.persist();
  }

  private applyMineTheme() {
    const definition = getMineDefinition(this.activeMineId);
    const sector = getSectorDefinition(definition.sectorId);
    this.mine?.setFillStyle(definition.theme.mine, 1);
    this.surface?.setFillStyle(definition.theme.surface, 1);
    this.hint?.setText(`${sector.code} · ${definition.code} · ${definition.name.toUpperCase()} · ${definition.resourceName.toUpperCase()}`);
  }

  private getWorldViewCacheMs(): number {
    const quality = useGameStore.getState().quality;
    return quality === 'LOW' ? 3000 : quality === 'MEDIUM' ? 2000 : 1200;
  }

  private getWorldMineViews(): WorldMineView[] {
    const now = Date.now();
    if (this.worldViewsCache.length && now - this.worldViewsCacheAt < this.getWorldViewCacheMs()) return this.worldViewsCache;

    const views = WORLD_MINES.map((definition) => {
      const sector = getSectorDefinition(definition.sectorId);
      const unlocked = this.unlockedMines.has(definition.id);
      const state = unlocked ? this.getPersistentMine(definition.id) : null;
      const sim = state ? this.createSimulation(definition.id, state) : null;
      if (sim) sim.setCash(this.getSectorWallet(definition.sectorId));
      const previousState = definition.previousMineId ? this.getPersistentMine(definition.previousMineId) : null;
      const previousDefinition = definition.previousMineId ? getMineDefinition(definition.previousMineId) : null;
      const rebuild = sim?.getRebuildView();
      return {
        id: definition.id,
        sectorId: definition.sectorId,
        code: definition.code,
        name: definition.name,
        resourceName: definition.resourceName,
        description: definition.description,
        currencyCode: sector.currencyCode,
        currencyName: sector.currencyName,
        unlocked,
        active: definition.id === this.activeMineId,
        canUnlock: this.canUnlockMine(definition.id),
        unlockEarnedRequired: definition.unlockEarnedRequired,
        previousMineName: previousDefinition?.name ?? null,
        previousMineEarned: previousState?.totalCashEarned ?? 0,
        cash: this.getSectorWallet(definition.sectorId),
        totalCashEarned: state?.totalCashEarned ?? 0,
        incomePerSecond: sim?.getOfflineIncomePerSecond() ?? 0,
        unlockedDecks: sim?.getUnlockedShaftCount() ?? 0,
        rebuildLevel: rebuild?.level ?? 0,
        rebuildMultiplier: rebuild?.currentMultiplier ?? 1,
        mapX: definition.mapX,
        mapY: definition.mapY,
        accent: definition.theme.accent,
        accentSoft: definition.theme.accentSoft,
      };
    });
    this.worldViewsCache = views;
    this.worldViewsCacheAt = now;
    return views;
  }

  private getWorldSectorViews(): WorldSectorView[] {
    const now = Date.now();
    if (this.sectorViewsCache.length && now - this.sectorViewsCacheAt < this.getWorldViewCacheMs()) return this.sectorViewsCache;

    const mineViews = this.getWorldMineViews();
    const views = WORLD_SECTORS.map((definition) => {
      const sectorMines = mineViews.filter((mine) => mine.sectorId === definition.id);
      const previous = definition.previousSectorId ? getSectorDefinition(definition.previousSectorId) : null;
      return {
        id: definition.id,
        code: definition.code,
        name: definition.name,
        currencyCode: definition.currencyCode,
        currencyName: definition.currencyName,
        description: definition.description,
        unlocked: this.unlockedSectors.has(definition.id),
        active: getMineDefinition(this.activeMineId).sectorId === definition.id,
        canUnlock: this.canUnlockSector(definition.id),
        unlockEarnedRequired: definition.unlockEarnedRequired,
        previousSectorName: previous?.name ?? null,
        previousSectorEarned: previous ? this.getSectorLifetimeEarned(previous.id) : 0,
        wallet: this.getSectorWallet(definition.id),
        totalCashEarned: this.getSectorLifetimeEarned(definition.id),
        incomePerSecond: sectorMines.reduce((sum, mine) => sum + (mine.unlocked ? mine.incomePerSecond : 0), 0),
        unlockedMines: sectorMines.filter((mine) => mine.unlocked).length,
        totalMines: definition.mines.length,
        mapX: definition.mapX,
        mapY: definition.mapY,
        accent: definition.accent,
        accentSoft: definition.accentSoft,
      };
    });
    this.sectorViewsCache = views;
    this.sectorViewsCacheAt = now;
    return views;
  }

  private advanceInactiveMines(now: number) {
    // Доход активной шахты уже находится в симуляции — сначала переносим его в общий кошелек.
    this.syncActiveWalletFromSimulation();
    this.mineStates[this.activeMineId] = this.serializeMine(this.simulation);

    for (const id of this.unlockedMines) {
      if (id === this.activeMineId) continue;
      const definition = getMineDefinition(id);
      const state = this.mineStates[id] ?? this.serializeMine(this.createSimulation(id));
      const sim = this.createSimulation(id, state);
      // Ноль позволяет получить только заработок конкретной шахты и не дублировать общий кошелек сектора.
      sim.setCash(0);
      const lastAt = this.lastSimulatedAt[id] ?? now;
      const rawSeconds = Math.max(0, (now - lastAt) / 1000);
      const report = rawSeconds > 0 ? sim.applyOfflineProgress(rawSeconds) : null;
      if (report?.rewardCash) this.addSectorWallet(definition.sectorId, report.rewardCash);
      sim.setCash(0);
      this.mineStates[id] = this.serializeMine(sim);
      this.lastSimulatedAt[id] = now;
    }

    const activeSectorId = getMineDefinition(this.activeMineId).sectorId;
    this.simulation.setCash(this.getSectorWallet(activeSectorId));
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
  }

  private applyBackgroundProgress(now: number): OfflineProgressReport | null {
    let rewardCash = 0;
    let processedOre = 0;
    let incomePerSecond = 0;
    let automatedShafts = 0;
    let operatingMines = 0;
    let maxRawSeconds = 0;
    let maxCreditedSeconds = 0;
    let capped = false;
    const sectorRewards: Partial<Record<SectorId, number>> = {};

    this.syncActiveWalletFromSimulation();
    this.mineStates[this.activeMineId] = this.serializeMine(this.simulation);

    for (const id of this.unlockedMines) {
      const definition = getMineDefinition(id);
      const state = this.mineStates[id] ?? this.serializeMine(this.createSimulation(id));
      const sim = this.createSimulation(id, state);
      sim.setCash(0);
      const lastAt = this.lastSimulatedAt[id] ?? now;
      const rawSeconds = Math.max(0, (now - lastAt) / 1000);
      const report = sim.applyOfflineProgress(rawSeconds);

      if (report.rewardCash > 0) {
        this.addSectorWallet(definition.sectorId, report.rewardCash);
        sectorRewards[definition.sectorId] = (sectorRewards[definition.sectorId] ?? 0) + report.rewardCash;
      }
      sim.setCash(0);
      this.mineStates[id] = this.serializeMine(sim);
      this.lastSimulatedAt[id] = now;
      rewardCash += report.rewardCash;
      processedOre += report.processedOre;
      incomePerSecond += report.incomePerSecond;
      automatedShafts += report.automatedShafts;
      if (report.rewardCash > 0) operatingMines += 1;
      maxRawSeconds = Math.max(maxRawSeconds, report.rawSeconds);
      maxCreditedSeconds = Math.max(maxCreditedSeconds, report.creditedSeconds);
      capped ||= report.capped;
    }

    const activeDefinition = getMineDefinition(this.activeMineId);
    this.simulation = this.createSimulation(this.activeMineId, this.mineStates[this.activeMineId], true);
    this.simulation.setCash(this.getSectorWallet(activeDefinition.sectorId));
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;

    if (maxRawSeconds <= 0) return null;
    return {
      rawSeconds: maxRawSeconds,
      creditedSeconds: maxCreditedSeconds,
      rewardCash,
      processedOre,
      incomePerSecond,
      capped,
      fullChainAutomated: operatingMines > 0,
      automatedShafts,
      operatingMines,
      unlockedMines: this.unlockedMines.size,
      unlockedSectors: this.unlockedSectors.size,
      sectorRewards,
    };
  }

  private selectFacility(id: FacilityId, scrollIntoView = false) {
    this.selectedFacility = id;
    this.refreshSelectionVisuals();
    this.syncUi();
    if (scrollIntoView) this.scrollToFacility(id);
  }

  private scrollToFacility(id: FacilityId) {
    if (id === 'lift' || id === 'hub') {
      this.tweens.add({ targets: this.cameras.main, scrollY: 0, duration: 260, ease: 'Sine.Out' });
      return;
    }
    const depth = Number(id.slice('shaft-'.length));
    const target = this.shaftY(depth) - this.scale.height * 0.48;
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: Phaser.Math.Clamp(target, 0, this.maxScroll()),
      duration: 260,
      ease: 'Sine.Out',
    });
  }

  private refreshSelectionVisuals() {
    for (const [id, visual] of this.shaftVisuals) {
      visual.bg.setStrokeStyle(2, id === this.selectedFacility ? 0xf0b429 : 0x39424b, 1);
    }
    this.liftRail?.setStrokeStyle(2, this.selectedFacility === 'lift' ? 0xf0b429 : 0x77828b, 1);
    this.hubBuilding?.setStrokeStyle(2, this.selectedFacility === 'hub' ? 0xf0b429 : 0x6f8b94, 1);
  }

  private renderSimulation() {
    const state = this.simulation.getState();
    const currencyCode = getSectorDefinition(getMineDefinition(this.activeMineId).sectorId).currencyCode;
    const viewportTop = this.cameras.main.scrollY - this.rowHeight;
    const viewportBottom = this.cameras.main.scrollY + this.scale.height + this.rowHeight;

    for (const shaft of state.shafts) {
      const visual = this.shaftVisuals.get(shaft.id);
      if (!visual) continue;

      const manager = state.managers[shaft.id];
      const y = this.shaftY(shaft.depth);
      const inViewport = y >= viewportTop && y <= viewportBottom;
      visual.bg.setVisible(inViewport);
      visual.floor.setVisible(inViewport);
      visual.title.setVisible(inViewport);
      visual.buffer.setVisible(inViewport);
      visual.workerBody.setVisible(inViewport);
      visual.workerHead.setVisible(inViewport);
      visual.ore.setVisible(inViewport);
      visual.progressBg.setVisible(inViewport);
      visual.progressFill.setVisible(inViewport);
      visual.runButton.setVisible(inViewport);
      visual.runText.setVisible(inViewport);
      visual.autoBadge.setVisible(inViewport);
      if (!inViewport) continue;

      const xStart = Math.max(44, this.scale.width * 0.08);
      const liftX = this.liftX();
      const xEnd = Math.max(xStart + 80, liftX - Math.max(88, this.scale.width * 0.12));
      const progress = shaft.task ? Math.min(1, shaft.task.elapsed / shaft.task.duration) : 0;
      const outbound = progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
      const workerX = Phaser.Math.Linear(xStart, xEnd, Phaser.Math.Clamp(outbound, 0, 1));
      const accessible = shaft.depth <= state.barrier.maxAccessibleDepth;

      visual.bg.setFillStyle(shaft.unlocked ? 0x20262c : accessible ? 0x1a1f24 : 0x12161a, 1);
      visual.bg.setAlpha(accessible ? 1 : 0.6);
      visual.floor.setVisible(shaft.unlocked);
      visual.workerBody.setVisible(shaft.unlocked).setPosition(workerX, y + 4);
      visual.workerHead.setVisible(shaft.unlocked).setPosition(workerX, y - 9);
      visual.ore.setPosition(workerX + 10, y + 2).setVisible(Boolean(shaft.unlocked && shaft.task && progress > 0.45));
      visual.progressBg.setVisible(shaft.unlocked);
      visual.progressFill.setVisible(shaft.unlocked);
      visual.autoBadge.setVisible(Boolean(shaft.unlocked && manager?.hired));

      if (shaft.unlocked) {
        visual.title.setText(`${shaft.name.toUpperCase()} · LVL ${shaft.level}`).setColor('#f2f5f7');
        visual.buffer.setText(`${formatCompact(shaft.buffer)} ore`).setColor('#f0b429');
        visual.runText.setText(manager?.hired ? 'AUTO' : shaft.task ? '…' : '▶ RUN').setColor('#ffffff');
        visual.runButton.setFillStyle(manager?.hired ? 0x1d4a34 : shaft.task ? 0x252b31 : 0x313a42, 1);
        visual.autoBadge.setText((manager?.activeRemaining ?? 0) > 0 ? '⚡ BOOST' : 'AUTO');
      } else if (accessible) {
        const stats = this.simulation.getFacilityStats(shaft.id);
        visual.title.setText(`${shaft.name.toUpperCase()} · LOCKED`).setColor('#aab4bb');
        visual.buffer.setText(`${currencyCode} ${formatCompact(stats.unlockCost)}`).setColor('#f0b429');
        visual.runText.setText(stats.canUnlock ? 'UNLOCK' : 'LOCKED').setColor(stats.canUnlock ? '#16120a' : '#8d7c55');
        visual.runButton.setFillStyle(stats.canUnlock ? 0xd49b22 : 0x3b3425, 1);
      } else {
        visual.title.setText(`${shaft.name.toUpperCase()} · SEALED`).setColor('#59636b');
        visual.buffer.setText('BARRIER').setColor('#6b7278');
        visual.runText.setText('SEALED').setColor('#70777d');
        visual.runButton.setFillStyle(0x20252a, 1);
      }

      const barWidth = Math.max(58, (this.liftX() - 34) * 0.28);
      visual.progressFill.setSize(Math.max(1, barWidth * progress), 5);
    }

    const barrierViews = this.simulation.getBarrierViews();
    for (const barrier of barrierViews) {
      const visual = this.barrierVisuals.get(barrier.boundaryDepth);
      if (!visual) continue;
      const barrierY = this.barrierY(barrier.boundaryDepth);
      const inViewport = barrierY >= viewportTop && barrierY <= viewportBottom;
      visual.bg.setVisible(inViewport);
      visual.title.setVisible(inViewport);
      visual.subtitle.setVisible(inViewport);
      visual.button.setVisible(inViewport);
      visual.buttonText.setVisible(inViewport);
      if (!inViewport) continue;

      if (barrier.cleared) {
        visual.bg.setFillStyle(0x17261e, 0.78).setStrokeStyle(1, 0x315943, 1);
        visual.subtitle.setText('CLEARED').setColor('#7dd59d');
        visual.button.setFillStyle(0x1e3a2a, 1).setStrokeStyle(1, 0x35694d, 1);
        visual.buttonText.setText('OPEN').setColor('#9ff0bd');
      } else if (barrier.active) {
        visual.bg.setFillStyle(0x292113, 1).setStrokeStyle(1, 0xa27726, 1);
        visual.subtitle.setText(`CLEARING · ${Math.ceil(barrier.remaining)}s`).setColor('#f0c969');
        visual.button.setFillStyle(0x4a3a19, 1);
        visual.buttonText.setText(`${Math.ceil(barrier.remaining)}s`).setColor('#f4d988');
      } else if (state.barrier.maxAccessibleDepth === barrier.boundaryDepth) {
        visual.bg.setFillStyle(0x241f15, 1).setStrokeStyle(1, 0x8d7028, 1);
        visual.subtitle
          .setText(barrier.requirementsMet ? `CLEAR TO ${barrier.targetDepth}00 m` : `UNLOCK DECK ${barrier.boundaryDepth} FIRST`)
          .setColor(barrier.requirementsMet ? '#d5b45e' : '#8d7c55');
        visual.button.setFillStyle(barrier.canStart ? 0xb17d1b : 0x4b3d20, 1);
        visual.buttonText.setText(`${currencyCode} ${formatCompact(barrier.cost)}`).setColor(barrier.canStart ? '#15100a' : '#9b8754');
      } else {
        visual.bg.setFillStyle(0x151719, 0.8).setStrokeStyle(1, 0x33383d, 1);
        visual.subtitle.setText('SEALED').setColor('#565f66');
        visual.button.setFillStyle(0x202428, 1);
        visual.buttonText.setText('LOCKED').setColor('#5d656b');
      }
    }

    const liftTask = state.lift.task;
    let cageY = this.surfaceHeight - 20;
    if (liftTask?.sourceShaftId) {
      const source = state.shafts.find((shaft) => shaft.id === liftTask.sourceShaftId);
      if (source) {
        const targetY = this.shaftY(source.depth);
        const progress = Math.min(1, liftTask.elapsed / liftTask.duration);
        cageY = progress < 0.47
          ? Phaser.Math.Linear(this.surfaceHeight - 20, targetY, progress / 0.47)
          : Phaser.Math.Linear(targetY, this.surfaceHeight - 20, (progress - 0.47) / 0.53);
      }
    }
    this.liftCage?.setY(cageY);
    this.liftLabel?.setY(cageY - 7);
    this.liftCargo?.setY(cageY + 8).setText(formatCompact(state.lift.cargo));
    this.liftAutoText
      ?.setVisible(state.managers.lift.hired)
      .setText(state.managers.lift.activeRemaining > 0 ? '⚡ BOOST' : 'AUTO');

    const hubTask = state.hub.task;
    const hubProgress = hubTask ? Math.min(1, hubTask.elapsed / hubTask.duration) : 0;
    const truckStart = this.scale.width * 0.56;
    const truckEnd = this.scale.width * 0.82;
    const truckWave = hubProgress < 0.5 ? hubProgress / 0.5 : (1 - hubProgress) / 0.5;
    this.hubTruck?.setX(Phaser.Math.Linear(truckStart, truckEnd, Phaser.Math.Clamp(truckWave, 0, 1)));
    this.surfaceBufferText?.setText(`Surface: ${formatCompact(state.surfaceBuffer)} ore`);
    this.hubAutoText
      ?.setVisible(state.managers.hub.hired)
      .setText(state.managers.hub.activeRemaining > 0 ? '⚡ BOOST' : 'AUTO');

    const visibleDepth = Math.max(0, Math.round((this.cameras.main.scrollY / Math.max(1, this.worldHeight - this.surfaceHeight)) * SHAFT_COUNT * 100));
    this.depthText?.setText(`DEPTH ${visibleDepth} m`);
  }

  private layout(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.surfaceHeight = Phaser.Math.Clamp(height * 0.22, 104, 132);
    this.rowHeight = width < 520 ? 112 : 126;
    this.barrierGap = width < 520 ? 56 : 64;
    this.worldHeight = this.shaftY(SHAFT_COUNT) + this.rowHeight * 0.7;
    const liftX = this.liftX();

    this.cameras.main.setBounds(0, 0, width, this.worldHeight);
    this.setCameraScroll(this.cameras.main.scrollY);

    this.mine?.setPosition(width / 2, this.worldHeight / 2).setSize(width, this.worldHeight);
    this.surface?.setPosition(width / 2, this.surfaceHeight / 2).setSize(width, this.surfaceHeight);
    this.hint?.setPosition(width / 2, 14);
    this.depthText?.setPosition(Math.max(54, width * 0.08), this.surfaceHeight - 13);

    this.hubBuilding?.setPosition(width * 0.84, this.surfaceHeight * 0.43).setSize(Math.max(70, width * 0.18), 46);
    this.hubLabel?.setPosition(width * 0.84, this.surfaceHeight * 0.43);
    this.hubAutoText?.setPosition(width * 0.84, Math.max(28, this.surfaceHeight * 0.16));
    this.hubTruck?.setPosition(width * 0.56, this.surfaceHeight * 0.73).setSize(Math.max(50, width * 0.12), 22);
    this.surfaceBufferText?.setPosition(width * 0.40, this.surfaceHeight * 0.54);

    this.liftRail?.setPosition(liftX, (this.surfaceHeight + this.worldHeight) / 2).setSize(Math.max(32, width * 0.055), this.worldHeight - this.surfaceHeight - 8);
    this.liftCage?.setX(liftX).setSize(Math.max(28, width * 0.048), 34);
    this.liftLabel?.setX(liftX);
    this.liftCargo?.setX(liftX);
    this.liftAutoText?.setPosition(liftX, this.surfaceHeight - 28);

    for (let depth = 1; depth <= SHAFT_COUNT; depth += 1) {
      const id = makeShaftId(depth);
      const visual = this.shaftVisuals.get(id);
      if (!visual) continue;
      const y = this.shaftY(depth);
      const rowLeft = 14;
      const rowRight = liftX - Math.max(18, width * 0.025);
      const rowWidth = Math.max(160, rowRight - rowLeft);
      const rowX = rowLeft + rowWidth / 2;
      const barWidth = Math.max(58, rowWidth * 0.30);

      visual.bg.setPosition(rowX, y).setSize(rowWidth, this.rowHeight - 12);
      visual.floor.setPosition(rowX, y + this.rowHeight * 0.27).setSize(rowWidth * 0.9, 4);
      visual.title.setPosition(rowLeft + 8, y - this.rowHeight * 0.29);
      visual.autoBadge.setPosition(rowLeft + 8, y - this.rowHeight * 0.12);
      visual.buffer.setPosition(rowRight - 9, y - this.rowHeight * 0.29);
      visual.progressBg.setPosition(rowLeft + 8, y + this.rowHeight * 0.31).setSize(barWidth, 5);
      visual.progressFill.setPosition(rowLeft + 8, y + this.rowHeight * 0.31);
      visual.runButton.setPosition(rowRight - Math.max(48, rowWidth * 0.09), y + this.rowHeight * 0.14).setSize(Math.max(70, rowWidth * 0.16), 34);
      visual.runText.setPosition(rowRight - Math.max(48, rowWidth * 0.09), y + this.rowHeight * 0.14);
    }

    for (let boundary = SHAFTS_PER_BARRIER; boundary < SHAFT_COUNT; boundary += SHAFTS_PER_BARRIER) {
      const visual = this.barrierVisuals.get(boundary);
      if (!visual) continue;
      const y = this.barrierY(boundary);
      const rowLeft = 22;
      const rowRight = liftX - Math.max(24, width * 0.03);
      const rowWidth = Math.max(150, rowRight - rowLeft);
      visual.bg.setPosition(rowLeft + rowWidth / 2, y).setSize(rowWidth, 46);
      visual.title.setPosition(rowLeft + 10, y - 9);
      visual.subtitle.setPosition(rowLeft + 10, y + 9);
      visual.button.setPosition(rowRight - 50, y).setSize(92, 30);
      visual.buttonText.setPosition(rowRight - 50, y);
    }

    this.refreshSelectionVisuals();
    this.renderSimulation();
  }

  private syncUi() {
    const contractClock = getServerClock();
    this.weeklyContract = advanceWeeklyContract(this.weeklyContract, contractClock.now);
    this.syncActiveWalletFromSimulation();
    this.refreshRelics();
    const snapshot = this.simulation.getSnapshot();
    const stats = this.simulation.getFacilityStats(this.selectedFacility);
    const activeSectorId = getMineDefinition(this.activeMineId).sectorId;
    useGameStore.getState().syncSimulation(
      snapshot,
      this.selectedFacility,
      stats,
      this.simulation.canUpgrade(this.selectedFacility),
      stats.isUnlocked ? this.simulation.getManagerView(this.selectedFacility) : null,
      this.simulation.getManagerRoster(),
      this.simulation.getBulkUpgradeQuotes(this.selectedFacility),
      this.simulation.getBottleneckView(),
      this.simulation.getCurrentBarrierView(),
      this.simulation.getRebuildView(),
      this.getResearchView(),
      this.getSpecialistView(),
      this.getAcademyView(),
      buildEquipmentView(this.equipment),
      buildCollectionView(this.collection, this.lastCollectionCrate),
      buildRelicView(this.relics),
      buildWeeklyContractView(this.weeklyContract, contractClock.now, contractClock.source),
      this.activeMineId,
      activeSectorId,
      this.getWorldMineViews(),
      this.getWorldSectorViews(),
    );
  }

  private initializeFreshWorld(now = Date.now()) {
    this.activeMineId = DEFAULT_MINE_ID;
    this.unlockedSectors = new Set<SectorId>([DEFAULT_SECTOR_ID]);
    this.sectorWallets = { [DEFAULT_SECTOR_ID]: 0 };
    this.unlockedMines = new Set<MineId>([DEFAULT_MINE_ID]);
    this.research = { ...DEFAULT_RESEARCH_STATE, purchased: [] };
    this.specialists = sanitizeSpecialistSystem(DEFAULT_SPECIALIST_SYSTEM);
    this.academy = sanitizeAcademyState(DEFAULT_ACADEMY_STATE);
    this.equipment = sanitizeEquipmentState(DEFAULT_EQUIPMENT_STATE);
    this.collection = sanitizeCollectionState(DEFAULT_COLLECTION_STATE);
    this.relics = sanitizeRelicState(DEFAULT_RELIC_STATE);
    this.weeklyContract = createWeeklyContractState(now);
    this.lastCollectionCrate = [];
    this.relicContextKey = '';
    this.totalRebuildCache = null;
    this.simulation = this.createSimulation(DEFAULT_MINE_ID);
    this.simulation.setCash(0);
    this.mineStates = { [DEFAULT_MINE_ID]: this.serializeMine(this.simulation) };
    this.lastSimulatedAt = { [DEFAULT_MINE_ID]: now };
    this.worldViewsCacheAt = 0;
    this.sectorViewsCacheAt = 0;
  }

  private async restore() {
    const now = Date.now();
    try {
      const save = await loadGameState();
      if (save) {
        this.saveCreatedAt = save.createdAt;
        useGameStore.getState().setQuality(save.settings.quality);

        const knownMineIds = new Set(WORLD_MINES.map((mine) => mine.id));
        const knownSectorIds = new Set(WORLD_SECTORS.map((sector) => sector.id));
        const unlockedMines = save.world.unlockedMines.filter((id) => knownMineIds.has(id));
        const inferredSectors = unlockedMines.map((id) => getMineDefinition(id).sectorId);
        const unlockedSectors = (save.world.unlockedSectors ?? inferredSectors).filter((id) => knownSectorIds.has(id));

        this.unlockedSectors = new Set<SectorId>(unlockedSectors.length ? unlockedSectors : [DEFAULT_SECTOR_ID]);
        this.unlockedMines = new Set<MineId>(unlockedMines.length ? unlockedMines : [DEFAULT_MINE_ID]);
        // Любой открытый объект автоматически подтверждает открытие своего сектора.
        for (const id of this.unlockedMines) this.unlockedSectors.add(getMineDefinition(id).sectorId);

        this.activeMineId = this.unlockedMines.has(save.world.activeMineId)
          ? save.world.activeMineId
          : [...this.unlockedMines][0] ?? DEFAULT_MINE_ID;
        this.mineStates = { ...save.world.mines };
        this.totalRebuildCache = null;
        this.lastSimulatedAt = { ...save.world.lastSimulatedAt };
        this.sectorWallets = { ...save.world.sectorWallets };
        this.research = sanitizeResearchState(save.world.research ?? DEFAULT_RESEARCH_STATE);
        this.specialists = sanitizeSpecialistSystem(save.world.specialists ?? DEFAULT_SPECIALIST_SYSTEM);
        this.academy = sanitizeAcademyState(save.world.academy ?? DEFAULT_ACADEMY_STATE);
        this.equipment = sanitizeEquipmentState(save.world.equipment ?? DEFAULT_EQUIPMENT_STATE);
        this.collection = sanitizeCollectionState(save.world.collection ?? DEFAULT_COLLECTION_STATE);
        this.relics = sanitizeRelicState(save.world.relics ?? DEFAULT_RELIC_STATE);
        {
          const contractClock = getServerClock();
          this.weeklyContract = advanceWeeklyContract(
            sanitizeWeeklyContractState(save.world.weeklyContract, contractClock.now),
            contractClock.now,
          );
        }
        this.lastCollectionCrate = [];
        this.relicContextKey = '';
        advanceSpecialistTimers(this.specialists, Math.max(0, (now - save.lastSeenAt) / 1000));
        for (const sectorId of this.unlockedSectors) {
          if (this.sectorWallets[sectorId] === undefined) this.sectorWallets[sectorId] = 0;
        }

        for (const id of this.unlockedMines) {
          if (!this.mineStates[id]) this.mineStates[id] = this.serializeMine(this.createSimulation(id));
          else this.mineStates[id] = { ...this.mineStates[id]!, cash: 0 };
          if (!this.lastSimulatedAt[id]) this.lastSimulatedAt[id] = save.lastSeenAt;
        }

        const activeDefinition = getMineDefinition(this.activeMineId);
        this.simulation = this.createSimulation(this.activeMineId, this.mineStates[this.activeMineId], true);
        this.simulation.setCash(this.getSectorWallet(activeDefinition.sectorId));
        const report = this.applyBackgroundProgress(now);
        if (report && report.rawSeconds >= STAGE_ONE_BALANCE.idle.minimumReportSeconds) {
          useGameStore.getState().setOfflineReport(report);
        }
      } else {
        this.initializeFreshWorld(now);
      }
    } catch {
      // Даже повреждённый локальный save не должен блокировать новую игру.
      this.initializeFreshWorld(now);
    } finally {
      this.applyMineTheme();
      this.applyCollectionVisuals();
      this.syncUi();
      this.renderSimulation();
      this.persistenceReady = true;
      await this.persist();
    }
  }

  private async handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = Date.now();
      await this.persist();
      return;
    }

    if (this.hiddenAt !== null) {
      const resumedAt = Date.now();
      advanceSpecialistTimers(this.specialists, Math.max(0, (resumedAt - this.hiddenAt) / 1000));
      const report = this.applyBackgroundProgress(resumedAt);
      if (report && report.rawSeconds >= STAGE_ONE_BALANCE.idle.minimumReportSeconds) {
        useGameStore.getState().setOfflineReport(report);
      }
      this.hiddenAt = null;
      this.applyMineTheme();
      this.applyCollectionVisuals();
      this.syncUi();
      this.renderSimulation();
      await this.persist();
    }
  }

  private async persist() {
    if (!this.persistenceReady) return;

    try {
      const now = this.hiddenAt ?? Date.now();
      const contractClock = getServerClock();
      this.weeklyContract = advanceWeeklyContract(this.weeklyContract, contractClock.now);
      // Пока игрок находится на одном объекте, остальные автоматизированные шахты
      // получают фоновый доход каждые 5 секунд вместе с autosave.
      this.advanceInactiveMines(now);
      this.syncActiveWalletFromSimulation();
      this.mineStates[this.activeMineId] = this.serializeMine(this.simulation);
      this.lastSimulatedAt[this.activeMineId] = now;
      await saveGameState({
        createdAt: this.saveCreatedAt,
        lastSeenAt: now,
        settings: { quality: useGameStore.getState().quality },
        world: {
          activeMineId: this.activeMineId,
          research: { ...this.research, purchased: [...this.research.purchased] },
          specialists: sanitizeSpecialistSystem(this.specialists),
          academy: sanitizeAcademyState(this.academy),
          equipment: sanitizeEquipmentState(this.equipment),
          collection: sanitizeCollectionState(this.collection),
          relics: sanitizeRelicState(this.relics),
          weeklyContract: sanitizeWeeklyContractState(this.weeklyContract, contractClock.now),
          unlockedSectors: [...this.unlockedSectors],
          sectorWallets: { ...this.sectorWallets },
          unlockedMines: [...this.unlockedMines],
          mines: { ...this.mineStates },
          lastSimulatedAt: { ...this.lastSimulatedAt },
        },
      });
    } catch {
      // Основной слот сохраняется с backup; при ошибке игра продолжает работать.
    }
  }

  private shaftY(depth: number): number {
    const barriersAbove = Math.floor((depth - 1) / SHAFTS_PER_BARRIER);
    return this.surfaceHeight + 72 + (depth - 1) * this.rowHeight + barriersAbove * this.barrierGap;
  }

  private barrierY(boundaryDepth: number): number {
    const current = this.shaftY(boundaryDepth);
    const next = this.shaftY(boundaryDepth + 1);
    return (current + next) / 2;
  }

  private liftX(): number {
    return this.scale.width * (this.scale.width < 520 ? 0.80 : 0.76);
  }

  private maxScroll(): number {
    return Math.max(0, this.worldHeight - this.scale.height);
  }

  private setCameraScroll(value: number) {
    this.cameras.main.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll());
  }

  private cleanup() {
    this.unsubscribeCommands?.();
    this.unsubscribeCommands = undefined;
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.scale.off('resize', this.layout, this);
    this.input.removeAllListeners('wheel');
    this.input.removeAllListeners('pointerdown');
    this.input.removeAllListeners('pointermove');
    this.input.removeAllListeners('pointerup');
    this.input.removeAllListeners('pointerupoutside');
  }
}
