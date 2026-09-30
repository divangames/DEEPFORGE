import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { PostgresRiftRepository } from './postgresRepository.js';
import { RiftService } from './service.js';
import { eventAt } from './engine.js';

// Запускать только на выделенной тестовой БД: RIFT_TEST_DATABASE_URL. Рабочую БД не очищаем.
describe.skipIf(!process.env.RIFT_TEST_DATABASE_URL)('Rift PostgreSQL integration', () => {
  it('persists across repository instances and serializes concurrent writers', async () => {
    const db = new pg.Pool({ connectionString: process.env.RIFT_TEST_DATABASE_URL });
    let playerId = '';
    try {
      const repository = new PostgresRiftRepository(db); await repository.initialize();
      const now = Date.UTC(2026, 8, 30);
      const service = new RiftService(repository, () => now);
      const guest = await service.register('PG test'); playerId = guest.playerId;
      const eventId = eventAt(now).id;
      await service.start(playerId, eventId);
      const payload = { requestId: randomUUID(), eventId, revision: 0, kind: 'upgrade' as const, target: 'lift', count: 1 as const };
      const results = await Promise.all([service.action(playerId, payload), service.action(playerId, payload)]);
      expect(results[0].run?.score).toBe(10); expect(results[1].run?.revision).toBe(1);
      const reopened = new RiftService(new PostgresRiftRepository(db), () => now);
      expect(await reopened.authenticate(`Bearer ${guest.token}`)).toBe(playerId);
      expect((await reopened.status(playerId)).run?.score).toBe(10);
    } finally {
      if (playerId) {
        await db.query('DELETE FROM rift_scores WHERE player_id=$1', [playerId]);
        await db.query('DELETE FROM rift_accounts WHERE player_id=$1', [playerId]);
      }
      await db.end();
    }
  });
});
