import { describe, expect, it } from 'vitest';
import { applyBlitzAction, finishBlitzSession, getBlitzEventWindow, getRankMovement, getSessionThroughput, type BlitzSessionRecord } from './blitzEngine.js';

function session(): BlitzSessionRecord {
  return {
    id: 'test', playerId: 'DF-TEST-TEST', eventId: 'event', divisionIndex: 0, groupId: 'D1-G1',
    startedAt: 1_000, endsAt: 601_000, lastTickAt: 1_000, lastActionAt: 0,
    credits: 100, score: 0, extractionLevel: 1, liftLevel: 1, logisticsLevel: 1, finishedAt: null,
  };
}

describe('Blitz engine', () => {
  it('server action spends credits and increases score without accepting a client score', () => {
    const result = applyBlitzAction(session(), 'upgrade-lift', 2_000);
    expect(result.accepted).toBe(true);
    expect(result.session.liftLevel).toBe(2);
    expect(result.session.score).toBeGreaterThan(0);
    expect(result.session.credits).toBeLessThan(102);
  });

  it('finishes a session with a deterministic completion bonus', () => {
    const finished = finishBlitzSession(session(), 61_000);
    expect(finished.finishedAt).toBe(61_000);
    expect(finished.score).toBeGreaterThan(0);
    expect(getSessionThroughput(finished)).toBeGreaterThan(0);
  });

  it('promotes and demotes only when a group is large enough', () => {
    expect(getRankMovement(1, 50, 0)).toBe('promoted');
    expect(getRankMovement(50, 50, 2)).toBe('demoted');
    expect(getRankMovement(1, 2, 0)).toBe('stable');
  });

  it('uses a Monday UTC event window', () => {
    const event = getBlitzEventWindow(Date.UTC(2026, 8, 30, 12));
    expect(new Date(event.startsAt).getUTCDay()).toBe(1);
    expect(event.endsAt - event.startsAt).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
