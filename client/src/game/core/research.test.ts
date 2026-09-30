import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RESEARCH_STATE,
  canPurchaseResearchNode,
  getResearchModifiers,
  getResearchRespecQuote,
  purchaseResearchNode,
  respecResearch,
} from './research';

function fresh() {
  return { ...DEFAULT_RESEARCH_STATE, purchased: [] as string[] };
}

describe('Stage 8 Research Grid', () => {
  it('не позволяет купить узел второго tier без зависимости', () => {
    const state = fresh();
    expect(canPurchaseResearchNode('ind-2', state)).toBe(false);
  });

  it('покупает первый узел и применяет глобальный modifier', () => {
    const state = fresh();
    const next = purchaseResearchNode('ind-1', state);
    expect(next).not.toBeNull();
    expect(next?.cores).toBe(2);
    expect(next?.purchased).toContain('ind-1');
    const modifiers = getResearchModifiers(next?.purchased ?? []);
    expect(modifiers.shaftYieldMultiplier).toBeCloseTo(1.1);
  });

  it('respec возвращает вложенные cores за вычетом комиссии', () => {
    let state = fresh();
    state = purchaseResearchNode('ind-1', state)!;
    const quote = getResearchRespecQuote(state);
    expect(quote.spent).toBe(1);
    expect(quote.fee).toBe(1);
    const reset = respecResearch(state)!;
    expect(reset.purchased).toHaveLength(0);
    expect(reset.cores).toBe(state.cores + quote.refund);
  });
});
