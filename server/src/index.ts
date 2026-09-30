import cors from '@fastify/cors';
import Fastify from 'fastify';
import { env } from './config.js';
import { healthRoutes } from './routes/health.js';
import { timeRoutes } from './routes/time.js';
import { riftRoutes } from './routes/rift.js';
import { blitzRoutes } from './routes/blitz.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CLIENT_ORIGIN,
  credentials: false,
});

await app.register(healthRoutes);
await app.register(timeRoutes);
await app.register(blitzRoutes);
await app.register(riftRoutes);

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.status(500).send({ ok: false, error: 'INTERNAL_SERVER_ERROR' });
});

async function start() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

await start();
