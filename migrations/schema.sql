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