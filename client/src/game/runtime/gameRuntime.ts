import type { BulkUpgradeMode, FacilityId, MineId, SectorId, ShaftId } from '../core/types';
import type { SpecialistId, SpecialistSlot } from '../core/specialists';
import type { EquipmentId } from '../core/equipment';
import type { CollectionCardId } from '../core/collection';
import type { ContractFacilityId } from '../core/weeklyContract';
import type { SeasonRewardTrack } from '../core/seasonalCampaign';

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
  | { type: 'SPECIALIST_TRAIN'; specialistId: SpecialistId }
  | { type: 'SPECIALIST_RECRUIT'; specialistId: SpecialistId }
  | { type: 'SPECIALIST_RANK_UP'; specialistId: SpecialistId }
  | { type: 'SPECIALIST_PROMOTE'; specialistId: SpecialistId }
  | { type: 'ACADEMY_START' }
  | { type: 'ACADEMY_CLAIM' }
  | { type: 'ACADEMY_RECRUIT_SCAN' }
  | { type: 'EQUIPMENT_CRAFT'; equipmentId: EquipmentId }
  | { type: 'EQUIPMENT_EQUIP'; specialistId: SpecialistId; equipmentId: EquipmentId }
  | { type: 'EQUIPMENT_UNEQUIP'; specialistId: SpecialistId }
  | { type: 'COLLECTION_OPEN_CRATE' }
  | { type: 'COLLECTION_SELECT'; cardId: CollectionCardId }
  | { type: 'CONTRACT_MANUAL_SHIFT' }
  | { type: 'CONTRACT_UPGRADE'; facilityId: ContractFacilityId }
  | { type: 'CONTRACT_HIRE_MANAGER'; facilityId: ContractFacilityId }
  | { type: 'CONTRACT_CLAIM_MILESTONE'; milestoneId: string }
  | { type: 'SEASON_CLAIM_REWARD'; level: number; track: SeasonRewardTrack };

type CommandListener = (command: GameCommand) => void;

const listeners = new Set<CommandListener>();

export function sendGameCommand(command: GameCommand) {
  for (const listener of listeners) listener(command);
}

export function onGameCommand(listener: CommandListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
