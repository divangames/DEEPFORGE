import Phaser from 'phaser';
import { loadStageOneState, saveStageOneState } from '../../db/saveRepository';
import { useGameStore } from '../../state/gameStore';
import { formatCompact } from '../core/format';
import { MineSimulation } from '../core/MineSimulation';
import type { FacilityId, ShaftId } from '../core/types';
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

export class FoundationScene extends Phaser.Scene {
  private simulation = new MineSimulation();
  private selectedFacility: FacilityId = 'shaft-1';
  private shaftVisuals = new Map<ShaftId, ShaftVisual>();
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
  private syncAccumulator = 0;
  private unsubscribeCommands?: () => void;
  private saveCreatedAt = Date.now();
  private beforeUnloadHandler = () => { void this.persist(); };

  constructor() {
    super('FoundationScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#101318');
    this.createEnvironment();
    this.createShaftVisuals();
    this.createLiftVisuals();
    this.createHubVisuals();

    this.unsubscribeCommands = onGameCommand((command) => this.handleCommand(command));
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

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
    this.simulation.tick(deltaMs / 1000);
    this.renderSimulation();

    this.syncAccumulator += deltaMs;
    if (this.syncAccumulator >= 100) {
      this.syncAccumulator = 0;
      this.syncUi();
    }
  }

  private createEnvironment() {
    this.surface = this.add.rectangle(0, 0, 100, 100, 0x29333a).setOrigin(0.5);
    this.mine = this.add.rectangle(0, 0, 100, 100, 0x171b20).setOrigin(0.5);

    this.hint = this.add.text(0, 0, 'НАЙМИ МЕНЕДЖЕРОВ — ЦЕПОЧКА СТАНЕТ АВТОМАТИЧЕСКОЙ', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#b9c5cc',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
  }

  private createShaftVisuals() {
    const ids: ShaftId[] = ['shaft-1', 'shaft-2', 'shaft-3'];

    for (const id of ids) {
      const bg = this.add.rectangle(0, 0, 100, 60, 0x20262c)
        .setStrokeStyle(2, 0x39424b, 1)
        .setInteractive({ useHandCursor: true });
      const floor = this.add.rectangle(0, 0, 100, 4, 0x59636c);
      const title = this.add.text(0, 0, id.toUpperCase(), {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#f2f5f7', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      const buffer = this.add.text(0, 0, '0 ore', {
        fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#f0b429', fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      const workerBody = this.add.rectangle(0, 0, 12, 20, 0xd17c35).setOrigin(0.5, 0.5);
      const workerHead = this.add.circle(0, 0, 6, 0xe2b58b);
      const ore = this.add.circle(0, 0, 6, 0xf0b429).setVisible(false);
      const progressBg = this.add.rectangle(0, 0, 100, 5, 0x0f1216).setOrigin(0, 0.5);
      const progressFill = this.add.rectangle(0, 0, 1, 5, 0xf0b429).setOrigin(0, 0.5);
      const runButton = this.add.rectangle(0, 0, 48, 32, 0x313a42)
        .setStrokeStyle(1, 0x66727c, 1)
        .setInteractive({ useHandCursor: true });
      const runText = this.add.text(0, 0, '▶', {
        fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      const autoBadge = this.add.text(0, 0, 'AUTO', {
        fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#9ff0bd', fontStyle: 'bold',
        backgroundColor: '#173326', padding: { x: 5, y: 3 },
      }).setOrigin(0, 0.5).setVisible(false);

      const activate = () => {
        this.selectFacility(id);
        this.simulation.startMining(id);
      };
      bg.on('pointerdown', activate);
      runButton.on('pointerdown', activate);

      this.shaftVisuals.set(id, {
        bg, floor, title, buffer, workerBody, workerHead, ore, progressBg, progressFill, runButton, runText, autoBadge,
      });
    }
  }

  private createLiftVisuals() {
    this.liftRail = this.add.rectangle(0, 0, 28, 100, 0x0c0f12)
      .setStrokeStyle(2, 0x77828b, 1)
      .setInteractive({ useHandCursor: true });
    this.liftCage = this.add.rectangle(0, 0, 24, 34, 0xf0b429)
      .setStrokeStyle(2, 0xffdd73, 1)
      .setInteractive({ useHandCursor: true });
    this.liftLabel = this.add.text(0, 0, 'LIFT', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#101318', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.liftCargo = this.add.text(0, 0, '0', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#101318', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.liftAutoText = this.add.text(0, 0, 'AUTO', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#9ff0bd', fontStyle: 'bold',
      backgroundColor: '#173326', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setVisible(false);

    const activate = () => {
      this.selectFacility('lift');
      this.simulation.startLift();
    };
    this.liftRail.on('pointerdown', activate);
    this.liftCage.on('pointerdown', activate);
  }

  private createHubVisuals() {
    this.hubBuilding = this.add.rectangle(0, 0, 84, 48, 0x36515b)
      .setStrokeStyle(2, 0x6f8b94, 1)
      .setInteractive({ useHandCursor: true });
    this.hubTruck = this.add.rectangle(0, 0, 58, 24, 0xcc5d46)
      .setStrokeStyle(2, 0xff8f76, 1)
      .setInteractive({ useHandCursor: true });
    this.hubLabel = this.add.text(0, 0, 'LOGISTICS', {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#f5f7fa', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hubAutoText = this.add.text(0, 0, 'AUTO', {
      fontFamily: 'Arial, sans-serif', fontSize: '9px', color: '#9ff0bd', fontStyle: 'bold',
      backgroundColor: '#173326', padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setVisible(false);
    this.surfaceBufferText = this.add.text(0, 0, 'Surface: 0 ore', {
      fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#f0b429', fontStyle: 'bold',
    }).setOrigin(0.5);

    const activate = () => {
      this.selectFacility('hub');
      this.simulation.startHub();
    };
    this.hubBuilding.on('pointerdown', activate);
    this.hubTruck.on('pointerdown', activate);
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
        this.selectFacility(command.facilityId);
        break;
    }
  }

  private selectFacility(id: FacilityId) {
    this.selectedFacility = id;
    this.refreshSelectionVisuals();
    this.syncUi();
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
    const height = this.scale.height;
    const surfaceHeight = Math.max(80, Math.min(118, height * 0.24));
    const mineTop = surfaceHeight;
    const mineHeight = Math.max(210, height - surfaceHeight);
    const rowHeight = mineHeight / 3;

    state.shafts.forEach((shaft, index) => {
      const visual = this.shaftVisuals.get(shaft.id);
      if (!visual) return;

      const manager = state.managers[shaft.id];
      const y = mineTop + rowHeight * (index + 0.5);
      const xStart = Math.max(40, this.scale.width * 0.11);
      const xEnd = Math.max(xStart + 80, this.scale.width * 0.62);
      const progress = shaft.task ? Math.min(1, shaft.task.elapsed / shaft.task.duration) : 0;
      const outbound = progress < 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
      const workerX = Phaser.Math.Linear(xStart, xEnd, Math.max(0, Math.min(1, outbound)));

      visual.workerBody.setPosition(workerX, y + 4);
      visual.workerHead.setPosition(workerX, y - 10);
      visual.ore.setPosition(workerX + 10, y + 2).setVisible(Boolean(shaft.task && progress > 0.45));
      visual.buffer.setText(`${formatCompact(shaft.buffer)} ore`);
      visual.runText.setText(manager.hired ? 'AUTO' : shaft.task ? '…' : '▶');
      visual.runButton.setFillStyle(manager.hired ? 0x1d4a34 : shaft.task ? 0x252b31 : 0x313a42, 1);
      visual.autoBadge
        .setVisible(manager.hired)
        .setText(manager.activeRemaining > 0 ? '⚡ BOOST' : 'AUTO');

      const barWidth = Math.max(60, this.scale.width * 0.22);
      visual.progressFill.setSize(Math.max(1, barWidth * progress), 5);
    });

    const liftTask = state.lift.task;
    let cageY = mineTop + 18;
    if (liftTask?.sourceShaftId) {
      const sourceIndex = state.shafts.findIndex((shaft) => shaft.id === liftTask.sourceShaftId);
      const targetY = mineTop + rowHeight * (sourceIndex + 0.5);
      const progress = Math.min(1, liftTask.elapsed / liftTask.duration);
      cageY = progress < 0.47
        ? Phaser.Math.Linear(mineTop + 18, targetY, progress / 0.47)
        : Phaser.Math.Linear(targetY, mineTop + 18, (progress - 0.47) / 0.53);
    }
    this.liftCage?.setY(cageY);
    this.liftLabel?.setY(cageY - 7);
    this.liftCargo?.setY(cageY + 8).setText(formatCompact(state.lift.cargo));
    this.liftAutoText
      ?.setVisible(state.managers.lift.hired)
      .setText(state.managers.lift.activeRemaining > 0 ? '⚡ BOOST' : 'AUTO');

    const hubTask = state.hub.task;
    const hubProgress = hubTask ? Math.min(1, hubTask.elapsed / hubTask.duration) : 0;
    const truckStart = this.scale.width * 0.62;
    const truckEnd = this.scale.width * 0.83;
    const truckWave = hubProgress < 0.5 ? hubProgress / 0.5 : (1 - hubProgress) / 0.5;
    this.hubTruck?.setX(Phaser.Math.Linear(truckStart, truckEnd, Math.max(0, Math.min(1, truckWave))));
    this.surfaceBufferText?.setText(`Surface: ${formatCompact(state.surfaceBuffer)} ore`);
    this.hubAutoText
      ?.setVisible(state.managers.hub.hired)
      .setText(state.managers.hub.activeRemaining > 0 ? '⚡ BOOST' : 'AUTO');
  }

  private layout(gameSize: Phaser.Structs.Size) {
    const width = gameSize.width;
    const height = gameSize.height;
    const surfaceHeight = Math.max(80, Math.min(118, height * 0.24));
    const mineTop = surfaceHeight;
    const mineHeight = Math.max(210, height - surfaceHeight);
    const rowHeight = mineHeight / 3;
    const liftX = width * 0.72;

    this.surface?.setPosition(width / 2, surfaceHeight / 2).setSize(width, surfaceHeight);
    this.mine?.setPosition(width / 2, mineTop + mineHeight / 2).setSize(width, mineHeight);
    this.hint?.setPosition(width / 2, 13);

    this.hubBuilding?.setPosition(width * 0.84, surfaceHeight * 0.43).setSize(Math.max(68, width * 0.2), 46);
    this.hubLabel?.setPosition(width * 0.84, surfaceHeight * 0.43);
    this.hubAutoText?.setPosition(width * 0.84, Math.max(22, surfaceHeight * 0.16));
    this.hubTruck?.setPosition(width * 0.62, surfaceHeight * 0.72).setSize(Math.max(46, width * 0.14), 22);
    this.surfaceBufferText?.setPosition(width * 0.42, surfaceHeight * 0.52);

    this.liftRail?.setPosition(liftX, mineTop + mineHeight / 2).setSize(Math.max(30, width * 0.075), mineHeight - 6);
    this.liftCage?.setX(liftX).setSize(Math.max(25, width * 0.062), Math.max(28, rowHeight * 0.38));
    this.liftLabel?.setX(liftX);
    this.liftCargo?.setX(liftX);
    this.liftAutoText?.setPosition(liftX, mineTop + 16);

    this.simulation.getState().shafts.forEach((shaft, index) => {
      const visual = this.shaftVisuals.get(shaft.id);
      if (!visual) return;
      const y = mineTop + rowHeight * (index + 0.5);
      const rowWidth = width * 0.66;
      const rowX = width * 0.34;
      const barWidth = Math.max(60, width * 0.22);

      visual.bg.setPosition(rowX, y).setSize(rowWidth, Math.max(56, rowHeight - 10));
      visual.floor.setPosition(rowX, y + rowHeight * 0.28).setSize(rowWidth * 0.9, 4);
      visual.title.setPosition(14, y - rowHeight * 0.28);
      visual.autoBadge.setPosition(14, y - rowHeight * 0.16);
      visual.buffer.setPosition(width * 0.61, y - rowHeight * 0.28);
      visual.progressBg.setPosition(14, y + rowHeight * 0.31).setSize(barWidth, 5);
      visual.progressFill.setPosition(14, y + rowHeight * 0.31);
      visual.runButton.setPosition(width * 0.61, y + rowHeight * 0.18).setSize(Math.max(52, width * 0.11), 32);
      visual.runText.setPosition(width * 0.61, y + rowHeight * 0.18);
    });

    this.refreshSelectionVisuals();
    this.renderSimulation();
  }

  private syncUi() {
    const snapshot = this.simulation.getSnapshot();
    const stats = this.simulation.getFacilityStats(this.selectedFacility);
    useGameStore.getState().syncSimulation(
      snapshot,
      this.selectedFacility,
      stats,
      this.simulation.canUpgrade(this.selectedFacility),
      this.simulation.getManagerView(this.selectedFacility),
      this.simulation.getManagerRoster(),
    );
  }

  private async restore() {
    try {
      const save = await loadStageOneState();
      if (!save) return;
      this.saveCreatedAt = save.createdAt;
      this.simulation = new MineSimulation(save.mine);
      this.syncUi();
      this.renderSimulation();
    } catch {
      // Локальный save не должен мешать запуску игры.
    }
  }

  private async persist() {
    try {
      await saveStageOneState({
        createdAt: this.saveCreatedAt,
        lastSeenAt: Date.now(),
        settings: { quality: useGameStore.getState().quality },
        mine: this.simulation.serialize(),
      });
    } catch {
      // Recovery UI появится на Stage 3, пока сохранение не блокирует игровой цикл.
    }
  }

  private cleanup() {
    this.unsubscribeCommands?.();
    this.unsubscribeCommands = undefined;
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    this.scale.off('resize', this.layout, this);
  }
}
