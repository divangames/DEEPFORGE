import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { healthRoutes } from './health.js';

describe('GET /api/health', () => {
  it('возвращает рабочий health-check', async () => {
    const app = Fastify();
    await app.register(healthRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: 'deepforge-server',
      database: 'not-configured',
    });

    await app.close();
  });
});
