-- Initial SQLite schema for the application.
-- Add domain-specific tables in subsequent migrations.

CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO app_metadata (key, value)
VALUES ('database_initialized', 'true')
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = datetime('now');
