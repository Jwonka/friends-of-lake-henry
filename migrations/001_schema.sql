CREATE TABLE IF NOT EXISTS donors (
                                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                                      name TEXT NOT NULL,
                                      amount_cents INTEGER NOT NULL,
                                      display_name TEXT,
                                      in_memory_of TEXT,
                                      source TEXT NOT NULL DEFAULT 'admin',
                                      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

CREATE INDEX IF NOT EXISTS idx_donors_created_at
    ON donors(created_at);

CREATE INDEX IF NOT EXISTS idx_donors_source
    ON donors(source);

-- Photos (for R2 + admin approval flow)
CREATE TABLE IF NOT EXISTS photos (
                                      id TEXT PRIMARY KEY,
                                      status TEXT NOT NULL,            -- 'pending' | 'approved'
                                      r2_key TEXT NOT NULL,
                                      content_type TEXT NOT NULL,
                                      category TEXT NOT NULL,
                                      title TEXT,
                                      caption TEXT,
                                      alt TEXT NOT NULL,
                                      submitted_by TEXT,
                                      submitted_at TEXT NOT NULL,
                                      approved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_photos_status
    ON photos(status);

CREATE INDEX IF NOT EXISTS idx_photos_category
    ON photos(category);

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
                                      id TEXT PRIMARY KEY,
                                      title TEXT NOT NULL,
                                      kind TEXT NOT NULL,                  -- Event | Raffle | Fundraiser | Meeting
                                      status TEXT NOT NULL DEFAULT 'draft',-- draft | published

                                      date_start TEXT,                     -- ISO date or datetime
                                      date_end   TEXT,
                                      is_tbd     INTEGER NOT NULL DEFAULT 0,

                                      location   TEXT,
                                      summary    TEXT,

                                      url        TEXT,
                                      url_label  TEXT,

                                      poster_key TEXT,                     -- later: R2 object key
                                      poster_alt TEXT,

                                      created_at TEXT NOT NULL DEFAULT (datetime('now')),
                                      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_status_date
    ON events(status, date_start);

CREATE TABLE IF NOT EXISTS raffle_winners (
                                              id TEXT PRIMARY KEY,
                                              raffle_key TEXT NOT NULL,
                                              draw_date TEXT NOT NULL,          -- ISO date: YYYY-MM-DD
                                              ticket_number INTEGER NOT NULL,
                                              winner_name TEXT NOT NULL,
                                              town TEXT NOT NULL,
                                              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

CREATE INDEX IF NOT EXISTS idx_raffle_winners_raffle_date
    ON raffle_winners(raffle_key, draw_date);

-- 1. Add prize support
ALTER TABLE raffle_winners
    ADD COLUMN prize TEXT;

-- 2. Enforce uniqueness per day + ticket + month
CREATE UNIQUE INDEX IF NOT EXISTS uniq_raffle_day_ticket
    ON raffle_winners (raffle_key, draw_date, ticket_number);

-- 3. Month metadata (title, rules)
CREATE TABLE IF NOT EXISTS raffle_months (
                                             month_key TEXT PRIMARY KEY,
                                             title TEXT NOT NULL,
                                             rules_json TEXT,
                                             created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                                             updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );