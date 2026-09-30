import { APP_CONFIG } from '../config/appConfig';

export interface ServerClockSnapshot {
  now: number;
  source: 'server' | 'local';
  offsetMs: number;
}

let offsetMs = 0;
let source: 'server' | 'local' = 'local';
let lastObservedNow = Date.now();

export async function syncServerClock(signal?: AbortSignal): Promise<ServerClockSnapshot> {
  const sentAt = Date.now();
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/time`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`API time: ${response.status}`);
  const data = await response.json() as { unixMs?: number };
  const receivedAt = Date.now();
  if (!Number.isFinite(data.unixMs)) throw new Error('API time: invalid response');
  const midpoint = sentAt + (receivedAt - sentAt) / 2;
  offsetMs = Number(data.unixMs) - midpoint;
  source = 'server';
  lastObservedNow = receivedAt + offsetMs;
  return getServerClock();
}

export function getServerClock(): ServerClockSnapshot {
  const candidate = Date.now() + offsetMs;
  // При откате системных часов не позволяем event-time идти назад в пределах сессии.
  const now = Math.max(lastObservedNow, candidate);
  lastObservedNow = now;
  return { now, source, offsetMs };
}

export function resetServerClockToLocal() {
  offsetMs = 0;
  source = 'local';
  lastObservedNow = Math.max(lastObservedNow, Date.now());
}
