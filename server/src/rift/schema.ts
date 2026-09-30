// Идемпотентная установка таблиц. Такая же миграция доступна в server/sql/003_rift.sql.
export const RIFT_SCHEMA = `
CREATE TABLE IF NOT EXISTS rift_accounts (
  player_id TEXT PRIMARY KEY,
  token_hash CHAR(64) UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rift_cohorts (
  event_id TEXT PRIMARY KEY,
  allocated INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rift_scores (
  event_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES rift_accounts(player_id),
  nickname TEXT NOT NULL,
  score BIGINT NOT NULL CHECK (score >= 0),
  reached_at BIGINT NOT NULL,
  PRIMARY KEY (event_id, player_id)
);
CREATE INDEX IF NOT EXISTS rift_scores_board_idx
  ON rift_scores(event_id, group_id, score DESC, reached_at ASC, player_id ASC);
`;
