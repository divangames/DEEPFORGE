import { describe, expect, it } from 'vitest';
import {
  addFriend,
  buildSocialView,
  claimCrewMission,
  createSocialState,
  getFriendIncomeMultiplier,
  joinCrewMission,
  startCrewMission,
} from './social';

describe('Stage 14 social / crew missions', () => {
  it('добавляет друзей и ограничивает глобальный friend bonus', () => {
    let state = createSocialState(0, 'DF-AAAA-2222');
    const ids = ['DF-BB22-CC22', 'DF-BB23-CC23', 'DF-BB24-CC24', 'DF-BB25-CC25', 'DF-BB26-CC26', 'DF-BB27-CC27'];
    for (const [index, id] of ids.entries()) state = addFriend(state, id, index + 1) ?? state;
    expect(state.friends.length).toBeGreaterThanOrEqual(5);
    expect(getFriendIncomeMultiplier(state)).toBeCloseTo(1.10, 5);
  });

  it('друг сокращает оставшееся время Crew Mission', () => {
    const now = 1_000_000;
    let state = createSocialState(now, 'DF-AAAA-2222');
    state = addFriend(state, 'DF-BBBB-3333', now) ?? state;
    const offer = buildSocialView(state, now, 'local').offers[0];
    state = startCrewMission(state, offer.id, now)!;
    const before = state.activeMission!.endsAt;
    state = joinCrewMission(state, 'DF-BBBB-3333', now + 60_000)!;
    expect(state.activeMission!.endsAt).toBeLessThan(before);
    expect(state.activeMission!.participantIds).toContain('DF-BBBB-3333');
  });

  it('завершает миссию только после таймера и меняет набор операций', () => {
    const now = 2_000_000;
    let state = createSocialState(now, 'DF-AAAA-2222');
    const firstOffer = buildSocialView(state, now, 'server').offers[0];
    state = startCrewMission(state, firstOffer.id, now)!;
    expect(claimCrewMission(state, now + 1_000)).toBeNull();
    const result = claimCrewMission(state, state.activeMission!.endsAt + 1)!;
    expect(result.state.completedMissions).toBe(1);
    expect(result.reward.label.length).toBeGreaterThan(0);
    expect(buildSocialView(result.state, state.activeMission!.endsAt + 2, 'server').offers[0].id).not.toBe(firstOffer.id);
  });
});
