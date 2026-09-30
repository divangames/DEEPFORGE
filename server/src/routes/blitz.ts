import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { finishBlitz, getBlitzStatus, performBlitzAction, startBlitzSession } from '../blitzStore.js';

const identitySchema = z.object({
  playerId: z.string().min(1).max(32),
  nickname: z.string().max(28).default('Operator'),
});

const actionSchema = z.object({
  playerId: z.string().min(1).max(32),
  sessionId: z.string().uuid(),
  action: z.enum(['upgrade-extraction', 'upgrade-lift', 'upgrade-logistics']),
});

const finishSchema = z.object({
  playerId: z.string().min(1).max(32),
  nickname: z.string().max(28).default('Operator'),
  sessionId: z.string().uuid(),
});

function statusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message === 'INVALID_PLAYER_ID') return 400;
  if (message === 'NO_TICKETS') return 409;
  if (message === 'SESSION_NOT_FOUND') return 404;
  return 400;
}

export async function blitzRoutes(app: FastifyInstance) {
  app.get('/api/blitz/status', async (request, reply) => {
    const parsed = identitySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST' });
    try {
      return { ok: true, ...(await getBlitzStatus(parsed.data.playerId, parsed.data.nickname)) };
    } catch (error) {
      return reply.status(statusCode(error)).send({ ok: false, error: error instanceof Error ? error.message : 'INVALID_REQUEST' });
    }
  });

  app.post('/api/blitz/start', async (request, reply) => {
    const parsed = identitySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST' });
    try {
      await startBlitzSession(parsed.data.playerId, parsed.data.nickname);
      return { ok: true, ...(await getBlitzStatus(parsed.data.playerId, parsed.data.nickname)) };
    } catch (error) {
      return reply.status(statusCode(error)).send({ ok: false, error: error instanceof Error ? error.message : 'INVALID_REQUEST' });
    }
  });

  app.post('/api/blitz/action', async (request, reply) => {
    const parsed = actionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST' });
    try {
      const result = await performBlitzAction(parsed.data.playerId, parsed.data.sessionId, parsed.data.action);
      if (!result.accepted) return reply.status(409).send({ ok: false, error: result.reason, session: result.session });
      return { ok: true, session: result.session };
    } catch (error) {
      return reply.status(statusCode(error)).send({ ok: false, error: error instanceof Error ? error.message : 'INVALID_REQUEST' });
    }
  });

  app.post('/api/blitz/finish', async (request, reply) => {
    const parsed = finishSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ ok: false, error: 'INVALID_REQUEST' });
    try {
      await finishBlitz(parsed.data.playerId, parsed.data.sessionId);
      const profileStatus = await getBlitzStatus(parsed.data.playerId, parsed.data.nickname);
      return { ok: true, ...profileStatus };
    } catch (error) {
      return reply.status(statusCode(error)).send({ ok: false, error: error instanceof Error ? error.message : 'INVALID_REQUEST' });
    }
  });
}
