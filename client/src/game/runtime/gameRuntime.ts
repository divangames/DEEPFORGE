import type { BulkUpgradeMode, FacilityId, ShaftId } from '../core/types';

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
  | { type: 'SELECT'; facilityId: FacilityId };

type CommandListener = (command: GameCommand) => void;

const listeners = new Set<CommandListener>();

export function sendGameCommand(command: GameCommand) {
  for (const listener of listeners) listener(command);
}

export function onGameCommand(listener: CommandListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
