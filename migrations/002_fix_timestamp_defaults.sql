
CREATE TABLE donors_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            amount_cents INTEGER NOT NULL,
                            display_name TEXT,
                            in_memory_of TEXT,
                            source TEXT NOT NULL DEFAULT 'admin',
                            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO donors_new (id, name, amount_cents, display_name, in_memory_of, source, created_at)
SELECT id, name, amount_cents, display_name, in_memory_of, source, created_at
FROM donors;

DROP TABLE donors;
ALTER TABLE donors_new RENAME TO donors;

CREATE INDEX IF NOT EXISTS idx_donors_created_at ON donors(created_at);
CREATE INDEX IF NOT EXISTS idx_donors_source ON donors(source);


CREATE TABLE events_new (
                            id TEXT PRIMARY KEY,
                            title TEXT NOT NULL,
                            kind TEXT NOT NULL,
                            status TEXT NOT NULL DEFAULT 'draft',

                            date_start TEXT,
                            date_end   TEXT,
                            is_tbd     INTEGER NOT NULL DEFAULT 0,

                            location   TEXT,
                            summary    TEXT,

                            url        TEXT,
                            url_label  TEXT,

                            poster_key TEXT,
                            poster_alt TEXT,

                            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO events_new (
    id, title, kind, status,
    date_start, date_end, is_tbd,
    location, summary,
    url, url_label,
    poster_key, poster_alt,
    created_at, updated_at
)
SELECT
    id, title, kind, status,
    date_start, date_end, is_tbd,
    location, summary,
    url, url_label,
    poster_key, poster_alt,
    created_at, updated_at
FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, date_start);
