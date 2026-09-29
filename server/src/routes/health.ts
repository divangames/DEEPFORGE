import type { FastifyInstance } from 'fastify';
import { getDatabaseStatus } from '../db/postgres.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    ok: true,
    service: 'deepforge-server',
    database: await getDatabaseStatus(),
    timestamp: new Date().toISOString(),
  }));
}
