import type { FastifyInstance } from 'fastify';

export async function timeRoutes(app: FastifyInstance) {
  app.get('/api/time', async () => {
    const now = Date.now();
    return {
      ok: true,
      unixMs: now,
      iso: new Date(now).toISOString(),
    };
  });
}
