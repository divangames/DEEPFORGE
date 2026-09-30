export const BLITZ_DIVISIONS = [
  'Prospect',
  'Operator',
  'Foreman',
  'Specialist',
  'Veteran',
  'Elite',
  'Master',
  'Legend',
] as const;

export type BlitzDivision = (typeof BLITZ_DIVISIONS)[number];
export type BlitzFacility = 'extraction' | 'lift' | 'logistics';
export type BlitzAction = `upgrade-${BlitzFacility}`;

export const BLITZ_SESSION_SECONDS = 10 * 60;
export const BLITZ_TICKETS_PER_EVENT = 3;
export const BLITZ_GROUP_SIZE = 50;

export interface BlitzEventWindow {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number;
  remainingSeconds: number;
}

export interface BlitzProfileRecord {
  playerId: string;
  nickname: string;
  divisionIndex: number;
  medals: number;
  currentEventId: string;
  groupId: string;
  ticketsUsed: number;
  previousRank: number | null;
  previousParticipants: number;
  previousMovement: 'promoted' | 'demoted' | 'stable' | null;
}

export interface BlitzSessionRecord {
  id: string;
  playerId: string;
  eventId: string;
  divisionIndex: number;
  groupId: string;
  startedAt: number;
  endsAt: number;
  lastTickAt: number;
  lastActionAt: number;
  credits: number;
  score: number;
  extractionLevel: number;
  liftLevel: number;
  logisticsLevel: number;
  finishedAt: number | null;
}

export interface BlitzEntryRecord {
  eventId: string;
  divisionIndex: number;
  groupId: string;
  playerId: string;
  nickname: string;
  score: number;
  finishedAt: number;
}

const BASE_RATE: Record<BlitzFacility, number> = {
  extraction: 1.2,
  lift: 1,
  logistics: 1.1,
};

const RATE_GROWTH: Record<BlitzFacility, number> = {
  extraction: 1.22,
  lift: 1.23,
  logistics: 1.21,
};

const BASE_COST: Record<BlitzFacility, number> = {
  extraction: 22,
  lift: 26,
  logistics: 24,
};

const COST_GROWTH: Record<BlitzFacility, number> = {
  extraction: 1.43,
  lift: 1.45,
  logistics: 1.44,
};

export function getBlitzEventWindow(now = Date.now()): BlitzEventWindow {
  const date = new Date(now);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const startsAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday, 0, 0, 0, 0);
  const endsAt = startsAt + 7 * 24 * 60 * 60 * 1000;
  const stamp = new Date(startsAt).toISOString().slice(0, 10);
  return {
    id: `blitz-${stamp}`,
    title: 'Blitz Drill · Velocity Run',
    startsAt,
    endsAt,
    remainingSeconds: Math.max(0, Math.ceil((endsAt - now) / 1000)),
  };
}

export function clampDivisionIndex(value: number): number {
  return Math.max(0, Math.min(BLITZ_DIVISIONS.length - 1, Math.floor(value || 0)));
}

export function getDivisionName(index: number): BlitzDivision {
  return BLITZ_DIVISIONS[clampDivisionIndex(index)];
}

export function getFacilityLevel(session: BlitzSessionRecord, facility: BlitzFacility): number {
  if (facility === 'extraction') return session.extractionLevel;
  if (facility === 'lift') return session.liftLevel;
  return session.logisticsLevel;
}

export function getFacilityRate(facility: BlitzFacility, level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return BASE_RATE[facility] * RATE_GROWTH[facility] ** (safeLevel - 1);
}

export function getUpgradeCost(facility: BlitzFacility, level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.ceil(BASE_COST[facility] * COST_GROWTH[facility] ** (safeLevel - 1));
}

export function getSessionThroughput(session: BlitzSessionRecord): number {
  return Math.min(
    getFacilityRate('extraction', session.extractionLevel),
    getFacilityRate('lift', session.liftLevel),
    getFacilityRate('logistics', session.logisticsLevel),
  );
}

export function advanceBlitzSession(session: BlitzSessionRecord, now = Date.now()): BlitzSessionRecord {
  if (session.finishedAt) return { ...session };
  const cappedNow = Math.min(now, session.endsAt);
  const elapsedSeconds = Math.max(0, (cappedNow - session.lastTickAt) / 1000);
  const credits = session.credits + elapsedSeconds * getSessionThroughput(session);
  return {
    ...session,
    credits,
    lastTickAt: cappedNow,
  };
}

export function applyBlitzAction(
  session: BlitzSessionRecord,
  action: BlitzAction,
  now = Date.now(),
): { session: BlitzSessionRecord; accepted: boolean; reason?: string } {
  let next = advanceBlitzSession(session, now);
  if (next.finishedAt || now >= next.endsAt) return { session: next, accepted: false, reason: 'SESSION_FINISHED' };
  if (now - next.lastActionAt < 40) return { session: next, accepted: false, reason: 'TOO_FAST' };

  const facility = action.replace('upgrade-', '') as BlitzFacility;
  if (!['extraction', 'lift', 'logistics'].includes(facility)) return { session: next, accepted: false, reason: 'INVALID_ACTION' };
  const level = getFacilityLevel(next, facility);
  const cost = getUpgradeCost(facility, level);
  if (next.credits + 1e-9 < cost) return { session: next, accepted: false, reason: 'NOT_ENOUGH_CREDITS' };

  next = { ...next, credits: next.credits - cost, lastActionAt: now };
  if (facility === 'extraction') next.extractionLevel += 1;
  if (facility === 'lift') next.liftLevel += 1;
  if (facility === 'logistics') next.logisticsLevel += 1;

  const throughput = getSessionThroughput(next);
  next.score += Math.floor(cost * 2 + throughput * 80 + (level + 1) * 12);
  return { session: next, accepted: true };
}

export function finishBlitzSession(session: BlitzSessionRecord, now = Date.now()): BlitzSessionRecord {
  if (session.finishedAt) return { ...session };
  const advanced = advanceBlitzSession(session, now);
  const finishedAt = Math.min(Math.max(now, advanced.startedAt), advanced.endsAt);
  const minLevel = Math.min(advanced.extractionLevel, advanced.liftLevel, advanced.logisticsLevel);
  const completionBonus = Math.floor(advanced.credits * 4 + getSessionThroughput(advanced) * 400 + minLevel * 250);
  return {
    ...advanced,
    score: advanced.score + completionBonus,
    finishedAt,
  };
}

export function getRankMovement(rank: number, participants: number, divisionIndex: number): 'promoted' | 'demoted' | 'stable' {
  if (participants < 5 || rank <= 0) return 'stable';
  const zone = Math.max(1, Math.ceil(participants * 0.15));
  if (rank <= zone && divisionIndex < BLITZ_DIVISIONS.length - 1) return 'promoted';
  if (rank > participants - zone && divisionIndex > 0) return 'demoted';
  return 'stable';
}

export function getMedalReward(rank: number, participants: number): number {
  if (rank <= 0 || participants <= 0) return 0;
  if (rank === 1) return 100;
  if (rank <= 3) return 70;
  if (rank <= Math.max(5, Math.ceil(participants * 0.1))) return 45;
  if (rank <= Math.ceil(participants * 0.5)) return 20;
  return 10;
}
