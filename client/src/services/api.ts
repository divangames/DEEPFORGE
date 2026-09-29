import { APP_CONFIG } from '../config/appConfig';

export interface HealthResponse {
  ok: boolean;
  service: string;
  database: 'connected' | 'not-configured' | 'unavailable';
  timestamp: string;
}

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/health`, { signal });
  if (!response.ok) throw new Error(`API health: ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
