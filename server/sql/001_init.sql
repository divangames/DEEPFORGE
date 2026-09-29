CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_saves (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_saves_updated_at
  ON player_saves(updated_at DESC);
