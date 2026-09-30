import { APP_CONFIG } from '../config/appConfig';
import type { BlitzActionId, BlitzStatusView } from '../game/core/blitz';

interface BlitzIdentity {
  playerId: string;
  nickname: string;
}

async function parseResponse(response: Response): Promise<any> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || `HTTP_${response.status}`);
    (error as Error & { code?: string }).code = body?.error;
    throw error;
  }
  return body;
}

export async function getBlitzStatus(identity: BlitzIdentity, signal?: AbortSignal): Promise<BlitzStatusView> {
  const params = new URLSearchParams({ playerId: identity.playerId, nickname: identity.nickname });
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/blitz/status?${params}`, { signal });
  return parseResponse(response) as Promise<BlitzStatusView>;
}

export async function startBlitzSession(identity: BlitzIdentity): Promise<BlitzStatusView> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/blitz/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(identity),
  });
  return parseResponse(response) as Promise<BlitzStatusView>;
}

export async function sendBlitzAction(identity: BlitzIdentity, sessionId: string, action: BlitzActionId): Promise<void> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/blitz/action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId: identity.playerId, sessionId, action }),
  });
  await parseResponse(response);
}

export async function finishBlitzSession(identity: BlitzIdentity, sessionId: string): Promise<BlitzStatusView> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/blitz/finish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playerId: identity.playerId, nickname: identity.nickname, sessionId }),
  });
  return parseResponse(response) as Promise<BlitzStatusView>;
}
