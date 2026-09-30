import type { FastifyInstance } from 'fastify';
import { pool } from '../db/postgres.js';
import { RiftError } from '../rift/engine.js';
import { MemoryRiftRepository } from '../rift/repository.js';
import { PostgresRiftRepository } from '../rift/postgresRepository.js';
import { RiftService, tokenHash } from '../rift/service.js';
import { parseAction, parseEvent, parseNickname } from '../rift/validation.js';

// Небольшой ограниченный token bucket. Для нескольких API-узлов нужен rate limit на reverse proxy.
export class RiftLimiter {
  private buckets = new Map<string, { count: number; until: number }>();
  allow(key: string, max: number, interval: number, now = Date.now()): boolean {
    if (this.buckets.size > 10000) {
      for (const [k, b] of this.buckets) if (b.until <= now) this.buckets.delete(k);
      if (this.buckets.size > 10000 && !this.buckets.has(key)) return false;
    }
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.until <= now) { bucket = { count: 0, until: now + interval }; this.buckets.set(key, bucket); }
    bucket.count += 1;
    return bucket.count <= max;
  }
}
export async function riftRoutes(app: FastifyInstance, options: { service?: RiftService } = {}) {
  let service = options.service;
  if (!service) {
    if (pool) {
      const repository = new PostgresRiftRepository(pool);
      // При ошибке PostgreSQL сервер НЕ переключается на временный рейтинг.
      await repository.initialize();
      service = new RiftService(repository);
    } else if (process.env.NODE_ENV !== 'production') service = new RiftService(new MemoryRiftRepository());
  }
  const api = service;
  const limiter = new RiftLimiter();
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/rift/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!api) return reply.status(503).send({ ok: false, error: 'DATABASE_REQUIRED' });
    if (!limiter.allow(`ip:${request.ip}`, 240, 60000)) return reply.status(429).send({ ok: false, error: 'RATE_LIMITED' });
    if (request.url.split('?')[0] === '/api/rift/guest' && !limiter.allow(`guest:${request.ip}`, 20, 3600_000))
      return reply.status(429).send({ ok: false, error: 'RATE_LIMITED' });
    if (request.headers.authorization && !limiter.allow(`auth:${tokenHash(request.headers.authorization)}`, 150, 60000))
      return reply.status(429).send({ ok: false, error: 'RATE_LIMITED' });
  });
  async function execute(operation: () => Promise<unknown>, reply: { status: (n: number) => { send: (body: unknown) => unknown } }) {
    try { return await operation(); }
    catch (error) {
      if (error instanceof RiftError) return reply.status(error.httpStatus).send({ ok: false, error: error.code });
      app.log.error(error);
      return reply.status(503).send({ ok: false, error: 'RIFT_UNAVAILABLE' });
    }
  }
  app.post('/api/rift/guest', { bodyLimit: 1024 }, async (request, reply) => execute(async () => api!.register(parseNickname(request.body)), reply));
  app.get('/api/rift/status', async (request, reply) => execute(async () => api!.status(await api!.authenticate(request.headers.authorization)), reply));
  app.post('/api/rift/start', { bodyLimit: 1024 }, async (request, reply) => execute(async () => {
    const id = await api!.authenticate(request.headers.authorization);
    return api!.start(id, parseEvent(request.body));
  }, reply));
  app.post('/api/rift/action', { bodyLimit: 2048 }, async (request, reply) => execute(async () => {
    const id = await api!.authenticate(request.headers.authorization);
    return api!.action(id, parseAction(request.body));
  }, reply));
}
