import { randomUUID } from 'node:crypto';
import { pool } from './db/postgres.js';
import {
  BLITZ_GROUP_SIZE,
  BLITZ_SESSION_SECONDS,
  BLITZ_TICKETS_PER_EVENT,
  advanceBlitzSession,
  applyBlitzAction,
  clampDivisionIndex,
  finishBlitzSession,
  getBlitzEventWindow,
  getDivisionName,
  getFacilityRate,
  getMedalReward,
  getRankMovement,
  getSessionThroughput,
  getUpgradeCost,
  type BlitzAction,
  type BlitzEntryRecord,
  type BlitzProfileRecord,
  type BlitzSessionRecord,
} from './blitzEngine.js';

const profiles = new Map<string, BlitzProfileRecord>();
const sessions = new Map<string, BlitzSessionRecord>();
const entries = new Map<string, BlitzEntryRecord>();
let schemaReady = false;

function normalizePlayerId(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function sanitizeNickname(value: string, playerId: string): string {
  const clean = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 28);
  return clean || `Operator ${playerId.slice(-4)}`;
}

function validPlayerId(playerId: string): boolean {
  return /^DF-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(playerId);
}

function entryKey(eventId: string, playerId: string): string {
  return `${eventId}:${playerId}`;
}


async function ensureSchema() {
  if (!pool || schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blitz_profiles (
      player_id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      division_index INTEGER NOT NULL DEFAULT 0,
      medals INTEGER NOT NULL DEFAULT 0,
      current_event_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      tickets_used INTEGER NOT NULL DEFAULT 0,
      previous_rank INTEGER,
      previous_participants INTEGER NOT NULL DEFAULT 0,
      previous_movement TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS blitz_sessions (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      division_index INTEGER NOT NULL,
      group_id TEXT NOT NULL,
      started_at BIGINT NOT NULL,
      ends_at BIGINT NOT NULL,
      last_tick_at BIGINT NOT NULL,
      last_action_at BIGINT NOT NULL,
      credits DOUBLE PRECISION NOT NULL,
      score BIGINT NOT NULL,
      extraction_level INTEGER NOT NULL,
      lift_level INTEGER NOT NULL,
      logistics_level INTEGER NOT NULL,
      finished_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS blitz_sessions_player_event_idx ON blitz_sessions(player_id, event_id);
    CREATE TABLE IF NOT EXISTS blitz_entries (
      event_id TEXT NOT NULL,
      division_index INTEGER NOT NULL,
      group_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      score BIGINT NOT NULL,
      finished_at BIGINT NOT NULL,
      PRIMARY KEY (event_id, player_id)
    );
    CREATE INDEX IF NOT EXISTS blitz_entries_board_idx ON blitz_entries(event_id, division_index, group_id, score DESC);
  `);
  schemaReady = true;
}

function rowToProfile(row: any): BlitzProfileRecord {
  return {
    playerId: row.player_id,
    nickname: row.nickname,
    divisionIndex: Number(row.division_index) || 0,
    medals: Number(row.medals) || 0,
    currentEventId: row.current_event_id,
    groupId: row.group_id,
    ticketsUsed: Number(row.tickets_used) || 0,
    previousRank: row.previous_rank == null ? null : Number(row.previous_rank),
    previousParticipants: Number(row.previous_participants) || 0,
    previousMovement: row.previous_movement ?? null,
  };
}

function rowToSession(row: any): BlitzSessionRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    eventId: row.event_id,
    divisionIndex: Number(row.division_index),
    groupId: row.group_id,
    startedAt: Number(row.started_at),
    endsAt: Number(row.ends_at),
    lastTickAt: Number(row.last_tick_at),
    lastActionAt: Number(row.last_action_at),
    credits: Number(row.credits),
    score: Number(row.score),
    extractionLevel: Number(row.extraction_level),
    liftLevel: Number(row.lift_level),
    logisticsLevel: Number(row.logistics_level),
    finishedAt: row.finished_at == null ? null : Number(row.finished_at),
  };
}

async function saveProfile(profile: BlitzProfileRecord) {
  profiles.set(profile.playerId, profile);
  if (!pool) return;
  await ensureSchema();
  await pool.query(
    `INSERT INTO blitz_profiles(player_id,nickname,division_index,medals,current_event_id,group_id,tickets_used,previous_rank,previous_participants,previous_movement,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT(player_id) DO UPDATE SET nickname=EXCLUDED.nickname,division_index=EXCLUDED.division_index,medals=EXCLUDED.medals,current_event_id=EXCLUDED.current_event_id,group_id=EXCLUDED.group_id,tickets_used=EXCLUDED.tickets_used,previous_rank=EXCLUDED.previous_rank,previous_participants=EXCLUDED.previous_participants,previous_movement=EXCLUDED.previous_movement,updated_at=NOW()`,
    [profile.playerId, profile.nickname, profile.divisionIndex, profile.medals, profile.currentEventId, profile.groupId, profile.ticketsUsed, profile.previousRank, profile.previousParticipants, profile.previousMovement],
  );
}

async function loadProfile(playerId: string): Promise<BlitzProfileRecord | null> {
  if (!pool) return profiles.get(playerId) ?? null;
  await ensureSchema();
  const result = await pool.query('SELECT * FROM blitz_profiles WHERE player_id=$1', [playerId]);
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

async function saveSession(session: BlitzSessionRecord) {
  sessions.set(session.id, session);
  if (!pool) return;
  await ensureSchema();
  await pool.query(
    `INSERT INTO blitz_sessions(id,player_id,event_id,division_index,group_id,started_at,ends_at,last_tick_at,last_action_at,credits,score,extraction_level,lift_level,logistics_level,finished_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT(id) DO UPDATE SET last_tick_at=EXCLUDED.last_tick_at,last_action_at=EXCLUDED.last_action_at,credits=EXCLUDED.credits,score=EXCLUDED.score,extraction_level=EXCLUDED.extraction_level,lift_level=EXCLUDED.lift_level,logistics_level=EXCLUDED.logistics_level,finished_at=EXCLUDED.finished_at`,
    [session.id, session.playerId, session.eventId, session.divisionIndex, session.groupId, session.startedAt, session.endsAt, session.lastTickAt, session.lastActionAt, session.credits, session.score, session.extractionLevel, session.liftLevel, session.logisticsLevel, session.finishedAt],
  );
}

async function loadSession(id: string): Promise<BlitzSessionRecord | null> {
  if (!pool) return sessions.get(id) ?? null;
  await ensureSchema();
  const result = await pool.query('SELECT * FROM blitz_sessions WHERE id=$1', [id]);
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

async function loadActiveSession(playerId: string, eventId: string): Promise<BlitzSessionRecord | null> {
  if (!pool) {
    return [...sessions.values()].find((s) => s.playerId === playerId && s.eventId === eventId && !s.finishedAt) ?? null;
  }
  await ensureSchema();
  const result = await pool.query('SELECT * FROM blitz_sessions WHERE player_id=$1 AND event_id=$2 AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1', [playerId, eventId]);
  return result.rows[0] ? rowToSession(result.rows[0]) : null;
}

async function upsertEntry(entry: BlitzEntryRecord) {
  const key = entryKey(entry.eventId, entry.playerId);
  const existing = entries.get(key);
  if (!existing || entry.score > existing.score) entries.set(key, entry);
  if (!pool) return;
  await ensureSchema();
  await pool.query(
    `INSERT INTO blitz_entries(event_id,division_index,group_id,player_id,nickname,score,finished_at)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(event_id,player_id) DO UPDATE SET nickname=EXCLUDED.nickname,score=GREATEST(blitz_entries.score,EXCLUDED.score),finished_at=CASE WHEN EXCLUDED.score >= blitz_entries.score THEN EXCLUDED.finished_at ELSE blitz_entries.finished_at END`,
    [entry.eventId, entry.divisionIndex, entry.groupId, entry.playerId, entry.nickname, entry.score, entry.finishedAt],
  );
}

async function getBoardEntries(eventId: string, divisionIndex: number, groupId: string): Promise<BlitzEntryRecord[]> {
  if (!pool) {
    return [...entries.values()]
      .filter((entry) => entry.eventId === eventId && entry.divisionIndex === divisionIndex && entry.groupId === groupId)
      .sort((a, b) => b.score - a.score || a.finishedAt - b.finishedAt);
  }
  await ensureSchema();
  const result = await pool.query(
    'SELECT event_id,division_index,group_id,player_id,nickname,score,finished_at FROM blitz_entries WHERE event_id=$1 AND division_index=$2 AND group_id=$3 ORDER BY score DESC, finished_at ASC LIMIT 100',
    [eventId, divisionIndex, groupId],
  );
  return result.rows.map((row: any) => ({ eventId: row.event_id, divisionIndex: Number(row.division_index), groupId: row.group_id, playerId: row.player_id, nickname: row.nickname, score: Number(row.score), finishedAt: Number(row.finished_at) }));
}

async function allocateGroup(eventId: string, divisionIndex: number, playerId: string): Promise<string> {
  let count = 0;
  if (!pool) {
    count = [...profiles.values()].filter((profile) => profile.currentEventId === eventId && profile.divisionIndex === divisionIndex).length;
  } else {
    await ensureSchema();
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM blitz_profiles WHERE current_event_id=$1 AND division_index=$2', [eventId, divisionIndex]);
    count = Number(result.rows[0]?.count) || 0;
  }
  const groupNumber = Math.floor(count / BLITZ_GROUP_SIZE) + 1;
  return `D${divisionIndex + 1}-G${groupNumber}`;
}

async function settlePreviousEvent(profile: BlitzProfileRecord): Promise<BlitzProfileRecord> {
  if (!profile.currentEventId) return profile;
  const board = await getBoardEntries(profile.currentEventId, profile.divisionIndex, profile.groupId);
  const rank = board.findIndex((entry) => entry.playerId === profile.playerId) + 1;
  const participants = board.length;
  const movement = getRankMovement(rank, participants, profile.divisionIndex);
  let divisionIndex = profile.divisionIndex;
  if (movement === 'promoted') divisionIndex += 1;
  if (movement === 'demoted') divisionIndex -= 1;
  const medals = profile.medals + getMedalReward(rank, participants);
  return {
    ...profile,
    divisionIndex: clampDivisionIndex(divisionIndex),
    medals,
    previousRank: rank || null,
    previousParticipants: participants,
    previousMovement: movement,
  };
}

export async function getOrCreateBlitzProfile(rawPlayerId: string, rawNickname: string, now = Date.now()): Promise<BlitzProfileRecord> {
  const playerId = normalizePlayerId(rawPlayerId);
  if (!validPlayerId(playerId)) throw new Error('INVALID_PLAYER_ID');
  const nickname = sanitizeNickname(rawNickname, playerId);
  const event = getBlitzEventWindow(now);
  let profile = await loadProfile(playerId);
  if (!profile) {
    profile = {
      playerId,
      nickname,
      divisionIndex: 0,
      medals: 0,
      currentEventId: event.id,
      groupId: await allocateGroup(event.id, 0, playerId),
      ticketsUsed: 0,
      previousRank: null,
      previousParticipants: 0,
      previousMovement: null,
    };
  } else if (profile.currentEventId !== event.id) {
    profile = await settlePreviousEvent(profile);
    profile = {
      ...profile,
      nickname,
      currentEventId: event.id,
      groupId: await allocateGroup(event.id, profile.divisionIndex, playerId),
      ticketsUsed: 0,
    };
  } else if (profile.nickname !== nickname) {
    profile = { ...profile, nickname };
  }
  await saveProfile(profile);
  return profile;
}

export async function startBlitzSession(rawPlayerId: string, rawNickname: string, now = Date.now()) {
  const profile = await getOrCreateBlitzProfile(rawPlayerId, rawNickname, now);
  const event = getBlitzEventWindow(now);
  const existing = await loadActiveSession(profile.playerId, event.id);
  if (existing) {
    const advanced = advanceBlitzSession(existing, now);
    await saveSession(advanced);
    return advanced;
  }
  if (profile.ticketsUsed >= BLITZ_TICKETS_PER_EVENT) throw new Error('NO_TICKETS');

  const session: BlitzSessionRecord = {
    id: randomUUID(),
    playerId: profile.playerId,
    eventId: event.id,
    divisionIndex: profile.divisionIndex,
    groupId: profile.groupId,
    startedAt: now,
    endsAt: Math.min(now + BLITZ_SESSION_SECONDS * 1000, event.endsAt),
    lastTickAt: now,
    lastActionAt: 0,
    credits: 60,
    score: 0,
    extractionLevel: 1,
    liftLevel: 1,
    logisticsLevel: 1,
    finishedAt: null,
  };
  await saveSession(session);
  await saveProfile({ ...profile, ticketsUsed: profile.ticketsUsed + 1 });
  return session;
}

export async function performBlitzAction(rawPlayerId: string, sessionId: string, action: BlitzAction, now = Date.now()) {
  const playerId = normalizePlayerId(rawPlayerId);
  const session = await loadSession(sessionId);
  if (!session || session.playerId !== playerId) throw new Error('SESSION_NOT_FOUND');
  const result = applyBlitzAction(session, action, now);
  await saveSession(result.session);
  return result;
}

export async function finishBlitz(rawPlayerId: string, sessionId: string, now = Date.now()) {
  const playerId = normalizePlayerId(rawPlayerId);
  const profile = await loadProfile(playerId);
  const session = await loadSession(sessionId);
  if (!profile || !session || session.playerId !== playerId) throw new Error('SESSION_NOT_FOUND');
  const finished = finishBlitzSession(session, now);
  await saveSession(finished);
  await upsertEntry({
    eventId: finished.eventId,
    divisionIndex: finished.divisionIndex,
    groupId: finished.groupId,
    playerId: finished.playerId,
    nickname: profile.nickname,
    score: finished.score,
    finishedAt: finished.finishedAt ?? now,
  });
  return finished;
}

function sessionView(session: BlitzSessionRecord | null, now: number) {
  if (!session) return null;
  const advanced = advanceBlitzSession(session, now);
  const timedOut = now >= advanced.endsAt;
  return {
    id: advanced.id,
    startedAt: advanced.startedAt,
    endsAt: advanced.endsAt,
    remainingSeconds: Math.max(0, Math.ceil((advanced.endsAt - now) / 1000)),
    credits: Math.floor(advanced.credits * 10) / 10,
    score: advanced.score,
    throughput: getSessionThroughput(advanced),
    timedOut,
    finished: Boolean(advanced.finishedAt),
    facilities: (['extraction', 'lift', 'logistics'] as const).map((facility) => ({
      id: facility,
      level: facility === 'extraction' ? advanced.extractionLevel : facility === 'lift' ? advanced.liftLevel : advanced.logisticsLevel,
      rate: getFacilityRate(facility, facility === 'extraction' ? advanced.extractionLevel : facility === 'lift' ? advanced.liftLevel : advanced.logisticsLevel),
      upgradeCost: getUpgradeCost(facility, facility === 'extraction' ? advanced.extractionLevel : facility === 'lift' ? advanced.liftLevel : advanced.logisticsLevel),
    })),
  };
}

export async function getBlitzStatus(rawPlayerId: string, rawNickname: string, now = Date.now()) {
  let profile = await getOrCreateBlitzProfile(rawPlayerId, rawNickname, now);
  const event = getBlitzEventWindow(now);
  let active = await loadActiveSession(profile.playerId, event.id);
  if (active) {
    active = advanceBlitzSession(active, now);
    if (now >= active.endsAt && !active.finishedAt) {
      active = await finishBlitz(profile.playerId, active.id, now);
    } else {
      await saveSession(active);
    }
  }

  profile = (await loadProfile(profile.playerId)) ?? profile;
  const board = await getBoardEntries(event.id, profile.divisionIndex, profile.groupId);
  const playerRank = board.findIndex((entry) => entry.playerId === profile.playerId) + 1;
  const participants = board.length;
  const zoneSize = participants >= 5 ? Math.max(1, Math.ceil(participants * 0.15)) : 0;
  const leaderboard = board.slice(0, 50).map((entry, index) => ({
    rank: index + 1,
    playerId: entry.playerId,
    nickname: entry.nickname,
    score: entry.score,
    self: entry.playerId === profile.playerId,
    zone: zoneSize > 0 && index + 1 <= zoneSize
      ? (profile.divisionIndex < 7 ? 'promotion' : 'safe')
      : zoneSize > 0 && index + 1 > participants - zoneSize
        ? (profile.divisionIndex > 0 ? 'demotion' : 'safe')
        : 'safe',
  }));

  return {
    event,
    profile: {
      playerId: profile.playerId,
      nickname: profile.nickname,
      divisionIndex: profile.divisionIndex,
      division: getDivisionName(profile.divisionIndex),
      medals: profile.medals,
      groupId: profile.groupId,
      ticketsLeft: Math.max(0, BLITZ_TICKETS_PER_EVENT - profile.ticketsUsed),
      ticketsMax: BLITZ_TICKETS_PER_EVENT,
      previousRank: profile.previousRank,
      previousParticipants: profile.previousParticipants,
      previousMovement: profile.previousMovement,
    },
    activeSession: sessionView(active && !active.finishedAt ? active : null, now),
    leaderboard,
    participants,
    playerRank: playerRank || null,
    promotionSlots: zoneSize,
    demotionSlots: zoneSize,
  };
}

export function resetBlitzMemoryForTests() {
  profiles.clear();
  sessions.clear();
  entries.clear();
}
