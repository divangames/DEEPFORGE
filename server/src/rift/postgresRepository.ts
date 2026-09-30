import type { Pool } from 'pg';
import { RiftError } from './engine.js';
import { newPlayer, type RiftEntry, type RiftPlayer, type RiftRepository, type RiftTransaction } from './repository.js';
import { RIFT_SCHEMA } from './schema.js';

export class PostgresRiftRepository implements RiftRepository {
  readonly mode = 'postgres' as const;
  constructor(private readonly db: Pool) {}
  async initialize() { await this.db.query(RIFT_SCHEMA); }
  async create(id: string, nickname: string, tokenHash: string) {
    await this.db.query('INSERT INTO rift_accounts(player_id,token_hash,nickname,state) VALUES($1,$2,$3,$4::jsonb)',
      [id, tokenHash, nickname, JSON.stringify(newPlayer(id, nickname))]);
  }
  async authenticate(tokenHash: string): Promise<string | null> {
    const result = await this.db.query<{ player_id: string }>('SELECT player_id FROM rift_accounts WHERE token_hash=$1', [tokenHash]);
    return result.rows[0]?.player_id ?? null;
  }
  async withPlayer<T>(id: string, operation: (tx: RiftTransaction) => Promise<T>): Promise<T> {
    const connection = await this.db.connect();
    try {
      await connection.query('BEGIN');
      // Блокировка общая для всех процессов API: две вкладки не спишут один ресурс дважды.
      const saved = await connection.query<{ state: RiftPlayer }>('SELECT state FROM rift_accounts WHERE player_id=$1 FOR UPDATE', [id]);
      const player = saved.rows[0]?.state;
      if (!player) throw new RiftError('UNAUTHORIZED', 401);
      const result = await operation({
        player,
        lockEvent: async (eventId, mode) => {
          // Итоговый рейтинг ждёт завершения всех действий, начатых перед границей недели.
          const sql = mode === 'exclusive'
            ? 'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)'
            : 'SELECT pg_advisory_xact_lock_shared(hashtext($1)::bigint)';
          await connection.query(sql, [`deepforge:${eventId}`]);
        },
        allocateGroup: async (eventId) => {
          const allocated = await connection.query<{ allocated: number }>(
            'INSERT INTO rift_cohorts(event_id,allocated) VALUES($1,1) ON CONFLICT(event_id) DO UPDATE SET allocated=rift_cohorts.allocated+1 RETURNING allocated', [eventId]);
          return `R-${String(Math.floor((Number(allocated.rows[0].allocated) - 1) / 100) + 1).padStart(4, '0')}`;
        },
        saveEntry: async (entry) => {
          await connection.query(`INSERT INTO rift_scores(event_id,group_id,player_id,nickname,score,reached_at) VALUES($1,$2,$3,$4,$5,$6)
            ON CONFLICT(event_id,player_id) DO UPDATE SET score=EXCLUDED.score,reached_at=EXCLUDED.reached_at,nickname=EXCLUDED.nickname`,
          [entry.eventId, entry.group, entry.playerId, entry.nickname, entry.score, entry.reachedAt]);
        },
        board: async (eventId, group) => {
          const rows = await connection.query<{ event_id: string; group_id: string; player_id: string; nickname: string; score: string; reached_at: string }>(
            'SELECT event_id,group_id,player_id,nickname,score,reached_at FROM rift_scores WHERE event_id=$1 AND group_id=$2 ORDER BY score DESC,reached_at ASC,player_id COLLATE "C" ASC LIMIT 100', [eventId, group]);
          return rows.rows.map((r): RiftEntry => ({ eventId: r.event_id, group: r.group_id, playerId: r.player_id, nickname: r.nickname, score: Number(r.score), reachedAt: Number(r.reached_at) }));
        },
      });
      await connection.query('UPDATE rift_accounts SET state=$2::jsonb,updated_at=NOW() WHERE player_id=$1', [id, JSON.stringify(player)]);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { connection.release(); }
  }
}
