import { describe, expect, it } from 'vitest';
import {
  buildSeasonalCampaignView,
  claimSeasonReward,
  createSeasonalCampaignState,
  getSeasonRequiredXp,
  getSeasonalCampaignDefinition,
  grantSeasonXp,
  setSeasonPremiumUnlocked,
} from './seasonalCampaign';

describe('Stage 13 Seasonal Campaign', () => {
  const now = Date.UTC(2026, 8, 30, 0, 0, 0);

  it('создаёт сезон на четыре недели с понедельника', () => {
    const def = getSeasonalCampaignDefinition(now);
    expect(def.endAt - def.startAt).toBe(28 * 24 * 60 * 60 * 1000);
    expect(new Date(def.startAt).getUTCDay()).toBe(1);
    expect(def.levels).toHaveLength(20);
  });

  it('начисляет XP и открывает уровень', () => {
    let state = createSeasonalCampaignState(now);
    state = grantSeasonXp(state, getSeasonRequiredXp(1), now);
    const view = buildSeasonalCampaignView(state, now, 'server');
    expect(view.currentLevel).toBe(1);
    expect(view.levels[0].canClaimFree).toBe(true);
  });

  it('free reward нельзя забрать дважды', () => {
    let state = createSeasonalCampaignState(now);
    state = grantSeasonXp(state, 10_000, now);
    const first = claimSeasonReward(state, 1, 'free', now);
    expect(first).not.toBeNull();
    expect(claimSeasonReward(first!.state, 1, 'free', now)).toBeNull();
  });

  it('premium track требует entitlement и сохраняет ретроактивную награду', () => {
    let state = createSeasonalCampaignState(now);
    state = grantSeasonXp(state, 10_000, now);
    expect(claimSeasonReward(state, 1, 'premium', now)).toBeNull();
    state = setSeasonPremiumUnlocked(state, true, now);
    expect(claimSeasonReward(state, 1, 'premium', now)).not.toBeNull();
  });
});
