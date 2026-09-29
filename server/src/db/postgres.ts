import pg from 'pg';
import { env } from '../config.js';

const { Pool } = pg;

export const pool = env.DATABASE_URL
  ? new Pool({ connectionString: env.DATABASE_URL })
  : null;

export async function getDatabaseStatus(): Promise<'connected' | 'not-configured' | 'unavailable'> {
  if (!pool) return 'not-configured';

  try {
    await pool.query('SELECT 1');
    return 'connected';
  } catch {
    return 'unavailable';
  }
}
