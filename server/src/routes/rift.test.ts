import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { riftRoutes } from './rift.js';
import { MemoryRiftRepository } from '../rift/repository.js';
import { RiftService } from '../rift/service.js';
import { eventAt } from '../rift/engine.js';

const NOW = Date.UTC(2026, 8, 30);
async function setup() {
  const app = Fastify();
  await app.register(riftRoutes, { service: new RiftService(new MemoryRiftRepository(), () => NOW) });
  await app.ready();
  return app;
}
describe('Rift HTTP routes', () => {
  it('requires authentication; public playerId cannot read another profile', async () => {
    const app = await setup();
    try {
      const unauthenticated = await app.inject({ method: 'GET', url: '/api/rift/status?playerId=DF-TEST-TEST' });
      expect(unauthenticated.statusCode).toBe(401);
      const guest = (await app.inject({ method: 'POST', url: '/api/rift/guest', payload: { nickname: 'Miner' } })).json();
      const headers = { authorization: `Bearer ${guest.token}` };
      const state = await app.inject({ method: 'GET', url: '/api/rift/status', headers });
      expect(state.statusCode).toBe(200);
      expect(state.json().player.id).toBe(guest.playerId);
      expect(state.headers['cache-control']).toBe('no-store');
    } finally { await app.close(); }
  });
  it('rejects client-supplied score and accepts an idempotent upgrade', async () => {
    const app = await setup();
    try {
      const guest = (await app.inject({ method: 'POST', url: '/api/rift/guest', payload: { nickname: 'Miner' } })).json();
      const headers = { authorization: `Bearer ${guest.token}` };
      const eventId = eventAt(NOW).id;
      await app.inject({ method: 'POST', url: '/api/rift/start', headers, payload: { eventId } });
      const action = { requestId: randomUUID(), eventId, revision: 0, kind: 'upgrade', target: 'lift', count: 1 };
      const rejected = await app.inject({ method: 'POST', url: '/api/rift/action', headers, payload: { ...action, score: 999999 } });
      expect(rejected.statusCode).toBe(400);
      const first = await app.inject({ method: 'POST', url: '/api/rift/action', headers, payload: action });
      const second = await app.inject({ method: 'POST', url: '/api/rift/action', headers, payload: action });
      expect(first.statusCode).toBe(200); expect(second.statusCode).toBe(200);
      expect(first.json().run.score).toBe(10); expect(second.json().run.revision).toBe(1);
    } finally { await app.close(); }
  });
  it('separates profiles even when both accounts use the same nickname', async () => {
    const app = await setup();
    try {
      const register = () => app.inject({ method: 'POST', url: '/api/rift/guest', payload: { nickname: 'Same' } });
      const a = (await register()).json(), b = (await register()).json();
      expect(a.playerId).not.toBe(b.playerId); expect(a.token).not.toBe(b.token);
      await app.inject({ method: 'POST', url: '/api/rift/start', headers: { authorization: `Bearer ${a.token}` }, payload: { eventId: eventAt(NOW).id } });
      const other = await app.inject({ method: 'GET', url: '/api/rift/status', headers: { authorization: `Bearer ${b.token}` } });
      expect(other.json().run).toBeNull();
    } finally { await app.close(); }
  });
  it('limits guest registrations, including query-string variants', async () => {
    const app = await setup();
    try {
      for (let i = 0; i < 20; i++) expect((await app.inject({ method: 'POST', url: `/api/rift/guest?t=${i}`, payload: { nickname: 'Miner' } })).statusCode).toBe(200);
      const result = await app.inject({ method: 'POST', url: '/api/rift/guest?t=overflow', payload: { nickname: 'Miner' } });
      expect(result.statusCode).toBe(429);
    } finally { await app.close(); }
  });
});
