import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EQUIPMENT_STATE,
  craftEquipment,
  equipSpecialist,
  getEquipmentSpecialistBonus,
  grantCraftMaterials,
  sanitizeEquipmentState,
} from './equipment';

describe('equipment', () => {
  it('crafts and equips an item with a real gameplay bonus', () => {
    let state = sanitizeEquipmentState(DEFAULT_EQUIPMENT_STATE);
    state = grantCraftMaterials(state, { alloy: 200, circuits: 200, fiber: 200 });
    const crafted = craftEquipment(state, 'deepcore-drill');
    expect(crafted).not.toBeNull();
    const equipped = equipSpecialist(crafted!, 'rook-hale', 'extraction', 'deepcore-drill');
    expect(equipped).not.toBeNull();
    const bonus = getEquipmentSpecialistBonus(equipped!, 'rook-hale');
    expect(bonus.passiveMultiplier).toBeGreaterThan(1);
    expect(bonus.abilityMultiplier).toBeGreaterThan(1);
  });

  it('rejects role-incompatible equipment', () => {
    let state = sanitizeEquipmentState(DEFAULT_EQUIPMENT_STATE);
    state = grantCraftMaterials(state, { alloy: 200, circuits: 200, fiber: 200 });
    const crafted = craftEquipment(state, 'vector-harness')!;
    expect(equipSpecialist(crafted, 'rook-hale', 'extraction', 'vector-harness')).toBeNull();
  });
});
