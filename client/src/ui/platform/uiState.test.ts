import { describe, expect, it } from 'vitest';
import { togglePanel, validateFriendId } from './uiState';
import { coverGameScene, isGameSceneCovered } from '../../game/runtime/viewPerformance';

describe('Одно окно поверх шахты', () => {
  it('открывает выбранный экран', () => expect(togglePanel(null, 'team', true)).toBe('team'));
  it('заменяет события на Rift, не складывая окна', () => expect(togglePanel('events', 'rift', true)).toBe('rift'));
  it('закрывает только нужный экран', () => expect(togglePanel('rift', 'events', false)).toBe('rift'));
  it('возвращается к шахте', () => expect(togglePanel('research', 'research', false)).toBe(null));
  it('покрытие сцены не снимается преждевременно и освобождается один раз', () => {
    const first = coverGameScene(), second = coverGameScene();
    expect(isGameSceneCovered()).toBe(true);
    first(); first(); expect(isGameSceneCovered()).toBe(true);
    second(); expect(isGameSceneCovered()).toBe(false);
  });
});

describe('Обратная связь формы друзей', () => {
  const self = 'DF-SELF-0001';
  it('показывает формат пустого/неверного ID', () => {
    for (const id of ['', 'wrong', 'DF-A-0001', 'DF-TEST-0001!!']) expect(validateFriendId(id, self, [], 20)).toContain('формате');
  });
  it('не добавляет собственный ID', () => expect(validateFriendId(self, self, [], 20)).toContain('ваш'));
  it('не добавляет дубль', () => expect(validateFriendId('DF-TEST-0001', self, ['DF-TEST-0001'], 20)).toContain('уже'));
  it('объясняет лимит', () => expect(validateFriendId('DF-TEST-0001', self, Array(20).fill('DF-XXXX-XXXX'), 20)).toContain('20'));
  it('разрешает корректный новый ID', () => expect(validateFriendId('DF-TEST-0001', self, [], 20)).toBe(null));
});
