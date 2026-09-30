import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { timeRoutes } from './time.js';

describe('GET /api/time', () => {
  it('возвращает серверное время', async () => {
    const app = Fastify();
    await app.register(timeRoutes);
    const response = await app.inject({ method: 'GET', url: '/api/time' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(typeof body.unixMs).toBe('number');
    expect(typeof body.iso).toBe('string');
    await app.close();
  });
});
