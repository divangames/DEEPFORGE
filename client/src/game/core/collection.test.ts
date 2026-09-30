import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLLECTION_STATE,
  getCollectionModifiers,
  openSupplyCrate,
  sanitizeCollectionState,
  selectCollectionCard,
} from './collection';

describe('collection', () => {
  it('opens a supply crate and activates the first obtained visuals', () => {
    const result = openSupplyCrate(sanitizeCollectionState(DEFAULT_COLLECTION_STATE));
    expect(result).not.toBeNull();
    expect(result!.cards).toHaveLength(3);
    expect(result!.state.supplyKeys).toBe(2);
    const modifiers = getCollectionModifiers(result!.state);
    expect(modifiers.shaftYieldMultiplier).toBeGreaterThan(1);
    expect(modifiers.liftCapacityMultiplier).toBeGreaterThan(1);
    expect(modifiers.hubCapacityMultiplier).toBeGreaterThan(1);
  });

  it('can switch an owned card in the same category', () => {
    let state = sanitizeCollectionState({ ...DEFAULT_COLLECTION_STATE, supplyKeys: 4 });
    for (let index = 0; index < 4; index += 1) state = openSupplyCrate(state)!.state;
    const selected = selectCollectionCard(state, 'deepcore-crew');
    expect(selected?.selected.crew).toBe('deepcore-crew');
  });
});
