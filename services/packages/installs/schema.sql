-- One row per (module, account) install. The UNIQUE constraint makes repeat
-- installs by the same account a no-op (INSERT OR IGNORE), so counts are
-- genuinely unique. account_hash is an HMAC of the Spotify account id — the
-- raw id is never stored.
--
-- ip_hash/asn/country are attribution, not identity: the account id is
-- client-asserted, so a flood of fabricated ids is possible, and without a
-- column that separates fake rows from real ones the only cleanup would be
-- truncating the module. ip_hash is an HMAC too, under the same secret.
CREATE TABLE IF NOT EXISTS installs (
	module       TEXT NOT NULL,
	account_hash TEXT NOT NULL,
	version      TEXT,
	ts           INTEGER NOT NULL,
	ip_hash      TEXT,
	asn          INTEGER,
	country      TEXT,
	UNIQUE (module, account_hash)
);

-- GET counts groups by module; index keeps it cheap as the table grows.
CREATE INDEX IF NOT EXISTS installs_module ON installs (module);

-- Pruning a spike scans by recency, then by origin within the window.
CREATE INDEX IF NOT EXISTS installs_ts ON installs (ts);
