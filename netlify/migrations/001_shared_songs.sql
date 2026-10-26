CREATE TABLE IF NOT EXISTS shared_songs (
  spotify_id VARCHAR(22) PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  cover_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shared_songs_spotify_id_format
    CHECK (spotify_id ~ '^[A-Za-z0-9]{22}$')
);
