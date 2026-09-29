import { describe, expect, it } from 'vitest';
import { getViewportKind } from './device';

describe('getViewportKind', () => {
  it('определяет мобильный экран', () => {
    expect(getViewportKind(390)).toBe('mobile');
  });

  it('определяет планшет', () => {
    expect(getViewportKind(900)).toBe('tablet');
  });

  it('определяет ПК', () => {
    expect(getViewportKind(1440)).toBe('desktop');
  });
});
