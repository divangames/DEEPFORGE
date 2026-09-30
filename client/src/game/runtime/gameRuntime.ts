import type { BulkUpgradeMode, FacilityId, MineId, SectorId, ShaftId } from '../core/types';
import type { SpecialistId, SpecialistSlot } from '../core/specialists';

export type GameCommand =
  | { type: 'START_SHAFT'; shaftId: ShaftId }
  | { type: 'START_LIFT' }
  | { type: 'START_HUB' }
  | { type: 'UPGRADE'; facilityId: FacilityId }
  | { type: 'UPGRADE_BULK'; facilityId: FacilityId; mode: BulkUpgradeMode }
  | { type: 'UNLOCK_SHAFT'; shaftId: ShaftId }
  | { type: 'START_BARRIER' }
  | { type: 'HIRE_MANAGER'; facilityId: FacilityId }
  | { type: 'ACTIVATE_MANAGER'; facilityId: FacilityId }
  | { type: 'SELECT'; facilityId: FacilityId }
  | { type: 'OPEN_MINE'; mineId: MineId }
  | { type: 'UNLOCK_MINE'; mineId: MineId }
  | { type: 'UNLOCK_SECTOR'; sectorId: SectorId }
  | { type: 'REBUILD_MINE' }
  | { type: 'RESEARCH_BUY'; nodeId: string }
  | { type: 'RESEARCH_RESET' }
  | { type: 'SPECIALIST_ASSIGN'; specialistId: SpecialistId; slot: SpecialistSlot }
  | { type: 'SPECIALIST_UNASSIGN'; slot: SpecialistSlot }
  | { type: 'SPECIALIST_ACTIVATE'; specialistId: SpecialistId }
  | { type: 'SPECIALIST_TRAIN'; specialistId: SpecialistId };

type CommandListener = (command: GameCommand) => void;

const listeners = new Set<CommandListener>();

export function sendGameCommand(command: GameCommand) {
  for (const listener of listeners) listener(command);
}

export function onGameCommand(listener: CommandListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
