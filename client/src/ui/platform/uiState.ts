/** Одновременно открыт ровно один экран; навигация не складывает модальные окна. */
export type PanelId = 'team' | 'map' | 'rebuild' | 'research' | 'weekly' | 'season' | 'blitz' | 'rift' | 'events' | 'system';
export type PanelState = PanelId | null;
export function togglePanel(current: PanelState, target: PanelId, open: boolean): PanelState {
  return open ? target : current === target ? null : current;
}

export function validateFriendId(value: string, self: string, ids: string[], limit: number): string | null {
  if (!/^DF-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value)) return 'Введите ID в формате DF-XXXX-XXXX.';
  if (value === self) return 'Это ваш ID. Введите ID другого игрока.';
  if (ids.includes(value)) return 'Этот игрок уже есть в списке.';
  if (ids.length >= limit) return `Можно добавить не более ${limit} друзей.`;
  return null;
}
