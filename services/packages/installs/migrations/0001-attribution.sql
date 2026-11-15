-- One-time, for the database created before schema.sql grew these columns.
-- A fresh database gets them from schema.sql and must not run this.
-- SQLite has no ADD COLUMN IF NOT EXISTS, so a second run errors rather than
-- being a no-op; that is the intended guard.
ALTER TABLE installs ADD COLUMN ip_hash TEXT;
ALTER TABLE installs ADD COLUMN asn INTEGER;
ALTER TABLE installs ADD COLUMN country TEXT;

CREATE INDEX IF NOT EXISTS installs_ts ON installs (ts);
