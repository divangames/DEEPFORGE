import { APP_CONFIG } from '../config/appConfig';
import type { RiftAction, RiftGuest, RiftStatus } from '../game/core/rift';

const base = APP_CONFIG.apiBaseUrl.replace(/\/$/, '');
const storageKey = `deepforge:rift:guest:v1:${base}`;
interface RiftIdentity { playerId: string; token: string }
export class RiftApiError extends Error {
  constructor(public readonly code: string) { super(code); }
}
export function hasRiftBackend(): boolean { return Boolean(base); }
export function loadRiftIdentity(): RiftIdentity | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as RiftIdentity | null;
    return saved && typeof saved.playerId === 'string' && /^[a-f0-9]{64}$/.test(saved.token) ? saved : null;
  } catch { return null; }
}
export function forgetRiftIdentity() { localStorage.removeItem(storageKey); }
async function request<T>(path: string, token: string | null, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (!base) throw new RiftApiError('SERVER_REQUIRED');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 8000);
  try {
    const response = await fetch(`${base}/api/rift/${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'omit',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });
    const result = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!response.ok || !result?.ok) throw new RiftApiError(response.status === 404 ? 'SERVER_OUTDATED' : result?.error ?? `HTTP_${response.status}`);
    return result as T;
  } catch (error) {
    if (error instanceof RiftApiError) throw error;
    if (signal?.aborted) throw error;
    throw new RiftApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR');
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
export async function registerRiftGuest(nickname: string): Promise<void> {
  // Не создаём гостя, если браузер не может сохранить его ключ.
  try { localStorage.setItem(`${storageKey}:probe`, '1'); localStorage.removeItem(`${storageKey}:probe`); }
  catch { throw new RiftApiError('STORAGE_UNAVAILABLE'); }
  const guest = await request<RiftGuest>('guest', null, { nickname: nickname.trim().slice(0, 28) || 'Operator' });
  localStorage.setItem(storageKey, JSON.stringify({ playerId: guest.playerId, token: guest.token }));
}
function identity(): RiftIdentity {
  const guest = loadRiftIdentity();
  if (!guest) throw new RiftApiError('LOGIN_REQUIRED');
  return guest;
}
export function riftStatus(signal?: AbortSignal) { return request<RiftStatus>('status', identity().token, undefined, signal); }
export function riftStart(eventId: string) { return request<RiftStatus>('start', identity().token, { eventId }); }
export function riftAction(action: RiftAction) { return request<RiftStatus>('action', identity().token, action); }
