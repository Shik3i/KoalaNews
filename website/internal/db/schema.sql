-- KoalaNews schema (clean rewrite, SQLite). Applied at startup if tables are missing.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT,
    email         TEXT NOT NULL UNIQUE,
    password      TEXT,
    role          TEXT NOT NULL DEFAULT 'USER',
    banned        INTEGER NOT NULL DEFAULT 0,
    banned_reason TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS source_feeds (
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL UNIQUE,
    title           TEXT,
    description     TEXT,
    language        TEXT NOT NULL DEFAULT 'en',
    last_fetched_at TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_source_feeds_lang ON source_feeds(language);

CREATE TABLE IF NOT EXISTS categories (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

CREATE TABLE IF NOT EXISTS feeds (
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL,
    title           TEXT,
    custom_title    TEXT,
    description     TEXT,
    language        TEXT NOT NULL DEFAULT 'en',
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_feed_id  TEXT REFERENCES source_feeds(id) ON DELETE CASCADE,
    category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
    last_fetched_at TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, url)
);
CREATE INDEX IF NOT EXISTS idx_feeds_user ON feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_feeds_source ON feeds(source_feed_id);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category_id);

CREATE TABLE IF NOT EXISTS articles (
    id             TEXT PRIMARY KEY,
    title          TEXT,
    link           TEXT,
    description    TEXT,
    content        TEXT,
    image_url      TEXT,
    pub_date       TEXT,
    guid           TEXT,
    source_feed_id TEXT REFERENCES source_feeds(id) ON DELETE CASCADE,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(source_feed_id, guid)
);
CREATE INDEX IF NOT EXISTS idx_articles_source_pub ON articles(source_feed_id, pub_date);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(pub_date);

-- A "custom feed" is a saved view: an optional keyword query plus a set of
-- selected feeds (via smart_feed_feeds). `query` may be empty (feed-only view);
-- the legacy `feed_id` column is unused by the new multi-feed model.
CREATE TABLE IF NOT EXISTS smart_feeds (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    query      TEXT NOT NULL DEFAULT '',
    feed_id    TEXT REFERENCES feeds(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_smart_feeds_user ON smart_feeds(user_id);

-- Membership of feeds in a custom feed (many-to-many).
CREATE TABLE IF NOT EXISTS smart_feed_feeds (
    smart_feed_id TEXT NOT NULL REFERENCES smart_feeds(id) ON DELETE CASCADE,
    feed_id       TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    PRIMARY KEY (smart_feed_id, feed_id)
);
CREATE INDEX IF NOT EXISTS idx_smart_feed_feeds_feed ON smart_feed_feeds(feed_id);

CREATE TABLE IF NOT EXISTS article_reads (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    read_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, article_id)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme             TEXT NOT NULL DEFAULT 'system',
    design            TEXT NOT NULL DEFAULT 'clean',
    card_style        TEXT NOT NULL DEFAULT 'magazine',
    density           TEXT NOT NULL DEFAULT 'comfortable',
    font_scale        TEXT NOT NULL DEFAULT 'medium',
    accent_color      TEXT NOT NULL DEFAULT '#2563eb',
    show_images       INTEGER NOT NULL DEFAULT 1,
    show_source       INTEGER NOT NULL DEFAULT 1,
    show_date         INTEGER NOT NULL DEFAULT 1,
    show_description   INTEGER NOT NULL DEFAULT 1,
    show_read_more     INTEGER NOT NULL DEFAULT 1,
    description_lines  INTEGER NOT NULL DEFAULT 3,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS image_cache (
    source_url   TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL,
    fetched_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_image_cache_fetched ON image_cache(fetched_at);

CREATE TABLE IF NOT EXISTS rate_limit_entries (
    key      TEXT PRIMARY KEY,
    count    INTEGER NOT NULL,
    reset_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
