export type BlitzFacilityId = 'extraction' | 'lift' | 'logistics';
export type BlitzActionId = `upgrade-${BlitzFacilityId}`;
export type BlitzZone = 'promotion' | 'safe' | 'demotion';

export interface BlitzEventView {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  remainingSeconds: number;
}

export interface BlitzProfileView {
  playerId: string;
  nickname: string;
  divisionIndex: number;
  division: string;
  medals: number;
  groupId: string;
  ticketsLeft: number;
  ticketsMax: number;
  previousRank: number | null;
  previousParticipants: number;
  previousMovement: 'promoted' | 'demoted' | 'stable' | null;
}

export interface BlitzFacilityView {
  id: BlitzFacilityId;
  level: number;
  rate: number;
  upgradeCost: number;
}

export interface BlitzSessionView {
  id: string;
  startedAt: number;
  endsAt: number;
  remainingSeconds: number;
  credits: number;
  score: number;
  throughput: number;
  timedOut: boolean;
  finished: boolean;
  facilities: BlitzFacilityView[];
}

export interface BlitzLeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  self: boolean;
  zone: BlitzZone;
}

export interface BlitzStatusView {
  ok: true;
  event: BlitzEventView;
  profile: BlitzProfileView;
  activeSession: BlitzSessionView | null;
  leaderboard: BlitzLeaderboardEntry[];
  participants: number;
  playerRank: number | null;
  promotionSlots: number;
  demotionSlots: number;
}

export const BLITZ_FACILITY_LABELS: Record<BlitzFacilityId, string> = {
  extraction: 'Extraction Deck',
  lift: 'Cargo Lift',
  logistics: 'Logistics Hub',
};
