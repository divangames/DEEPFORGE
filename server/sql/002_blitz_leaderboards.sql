CREATE TABLE IF NOT EXISTS blitz_profiles (
  player_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  division_index INTEGER NOT NULL DEFAULT 0,
  medals INTEGER NOT NULL DEFAULT 0,
  current_event_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  tickets_used INTEGER NOT NULL DEFAULT 0,
  previous_rank INTEGER,
  previous_participants INTEGER NOT NULL DEFAULT 0,
  previous_movement TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blitz_sessions (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  division_index INTEGER NOT NULL,
  group_id TEXT NOT NULL,
  started_at BIGINT NOT NULL,
  ends_at BIGINT NOT NULL,
  last_tick_at BIGINT NOT NULL,
  last_action_at BIGINT NOT NULL,
  credits DOUBLE PRECISION NOT NULL,
  score BIGINT NOT NULL,
  extraction_level INTEGER NOT NULL,
  lift_level INTEGER NOT NULL,
  logistics_level INTEGER NOT NULL,
  finished_at BIGINT
);

CREATE INDEX IF NOT EXISTS blitz_sessions_player_event_idx ON blitz_sessions(player_id, event_id);

CREATE TABLE IF NOT EXISTS blitz_entries (
  event_id TEXT NOT NULL,
  division_index INTEGER NOT NULL,
  group_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  score BIGINT NOT NULL,
  finished_at BIGINT NOT NULL,
  PRIMARY KEY (event_id, player_id)
);

CREATE INDEX IF NOT EXISTS blitz_entries_board_idx
  ON blitz_entries(event_id, division_index, group_id, score DESC);
