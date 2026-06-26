-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ? LIMIT 1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ? LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (id, name, email, password, role)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: CountUsers :one
SELECT count(*) FROM users;

-- name: GetSetting :one
SELECT value FROM settings WHERE key = ? LIMIT 1;

-- name: UpsertSetting :exec
INSERT INTO settings (key, value) VALUES (?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

-- name: GetSourceFeedByURL :one
SELECT * FROM source_feeds WHERE url = ? LIMIT 1;

-- name: UpsertSourceFeed :one
INSERT INTO source_feeds (id, url, language)
VALUES (?, ?, ?)
ON CONFLICT(url) DO UPDATE SET language = excluded.language
RETURNING *;

-- name: UpdateSourceFeedMeta :exec
UPDATE source_feeds
SET title = ?, description = ?, language = ?, last_fetched_at = datetime('now')
WHERE id = ?;

-- name: ListSourceFeedsToSync :many
SELECT * FROM source_feeds
WHERE last_fetched_at IS NULL OR last_fetched_at < datetime('now', ?);

-- name: ListExistingGuids :many
SELECT guid FROM articles WHERE source_feed_id = ? AND guid IS NOT NULL;

-- name: CountArticlesForSource :one
SELECT count(*) FROM articles WHERE source_feed_id = ?;

-- name: InsertArticle :exec
INSERT INTO articles (id, title, link, description, content, image_url, pub_date, guid, source_feed_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(source_feed_id, guid) DO NOTHING;

-- name: ListArticlesByLanguage :many
SELECT a.* FROM articles a
JOIN source_feeds sf ON sf.id = a.source_feed_id
WHERE sf.language = ?
ORDER BY a.pub_date DESC NULLS LAST, a.created_at DESC
LIMIT ? OFFSET ?;

-- name: CreateFeed :one
INSERT INTO feeds (id, url, title, description, language, user_id, source_feed_id, last_fetched_at)
VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
RETURNING *;

-- name: ListFeedsByUser :many
SELECT * FROM feeds WHERE user_id = ? ORDER BY created_at DESC;

-- name: SetFeedCategory :exec
UPDATE feeds SET category_id = ? WHERE id = ? AND user_id = ?;

-- name: CreateCategory :one
INSERT INTO categories (id, name, user_id) VALUES (?, ?, ?)
RETURNING *;

-- name: ListCategoriesByUser :many
SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC;

-- name: GetCategoryByID :one
SELECT * FROM categories WHERE id = ? LIMIT 1;

-- name: RenameCategory :exec
UPDATE categories SET name = ? WHERE id = ? AND user_id = ?;

-- name: DeleteCategoryForUser :exec
DELETE FROM categories WHERE id = ? AND user_id = ?;

-- name: ListArticlesForUserByCategory :many
SELECT DISTINCT a.id, a.title, a.link, a.description, a.content, a.image_url,
  a.pub_date, a.guid, a.source_feed_id, a.created_at,
  CASE WHEN EXISTS(
    SELECT 1 FROM article_reads ar WHERE ar.user_id = ? AND ar.article_id = a.id
  ) THEN 1 ELSE 0 END AS read
FROM articles a
JOIN feeds f ON f.source_feed_id = a.source_feed_id
WHERE f.user_id = ? AND f.category_id = ?
ORDER BY a.pub_date DESC NULLS LAST, a.created_at DESC
LIMIT ? OFFSET ?;

-- name: GetFeedByID :one
SELECT * FROM feeds WHERE id = ? LIMIT 1;

-- name: GetUserFeedByURL :one
SELECT * FROM feeds WHERE user_id = ? AND url = ? LIMIT 1;

-- name: DeleteFeedForUser :exec
DELETE FROM feeds WHERE id = ? AND user_id = ?;

-- name: ListArticlesForUser :many
SELECT DISTINCT a.id, a.title, a.link, a.description, a.content, a.image_url,
  a.pub_date, a.guid, a.source_feed_id, a.created_at,
  CASE WHEN EXISTS(
    SELECT 1 FROM article_reads ar WHERE ar.user_id = ? AND ar.article_id = a.id
  ) THEN 1 ELSE 0 END AS read
FROM articles a
JOIN feeds f ON f.source_feed_id = a.source_feed_id
WHERE f.user_id = ?
ORDER BY a.pub_date DESC NULLS LAST, a.created_at DESC
LIMIT ? OFFSET ?;

-- name: MarkArticleRead :exec
INSERT INTO article_reads (user_id, article_id) VALUES (?, ?)
ON CONFLICT(user_id, article_id) DO NOTHING;

-- name: MarkArticleUnread :exec
DELETE FROM article_reads WHERE user_id = ? AND article_id = ?;

-- name: MarkAllReadForUser :exec
INSERT INTO article_reads (user_id, article_id)
SELECT ?, a.id FROM articles a
JOIN feeds f ON f.source_feed_id = a.source_feed_id
WHERE f.user_id = ?
ON CONFLICT(user_id, article_id) DO NOTHING;

-- name: GetCachedImage :one
SELECT content_type, data FROM image_cache WHERE source_url = ? LIMIT 1;

-- name: UpsertCachedImage :exec
INSERT INTO image_cache (source_url, content_type, data, fetched_at)
VALUES (?, ?, ?, datetime('now'))
ON CONFLICT(source_url) DO UPDATE SET content_type = excluded.content_type, data = excluded.data, fetched_at = excluded.fetched_at;

-- name: CreateSession :exec
INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?);

-- name: GetSession :one
SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now') LIMIT 1;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= datetime('now');

-- name: DeleteSessionsForUser :exec
DELETE FROM sessions WHERE user_id = ?;

-- name: ListUsers :many
SELECT id, name, email, role, banned, banned_reason, created_at
FROM users ORDER BY created_at DESC;

-- name: SetUserRoleBanned :exec
UPDATE users SET role = ?, banned = ?, banned_reason = ? WHERE id = ?;

-- name: CountFeeds :one
SELECT count(*) FROM feeds;

-- name: CountArticles :one
SELECT count(*) FROM articles;

-- name: CountSourceFeeds :one
SELECT count(*) FROM source_feeds;

-- name: GetRateLimit :one
SELECT count, reset_at FROM rate_limit_entries WHERE key = ? LIMIT 1;

-- name: SetRateLimit :exec
INSERT INTO rate_limit_entries (key, count, reset_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET count = excluded.count, reset_at = excluded.reset_at;

-- name: CreateUserPreference :exec
INSERT INTO user_preferences (user_id) VALUES (?)
ON CONFLICT(user_id) DO NOTHING;

-- name: GetUserPreference :one
SELECT * FROM user_preferences WHERE user_id = ? LIMIT 1;

-- name: UpsertUserPreference :exec
INSERT INTO user_preferences (
  user_id, theme, design, card_style, density, font_scale, accent_color,
  show_images, show_source, show_date, show_description, description_lines, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
ON CONFLICT(user_id) DO UPDATE SET
  theme = excluded.theme, design = excluded.design, card_style = excluded.card_style,
  density = excluded.density, font_scale = excluded.font_scale, accent_color = excluded.accent_color,
  show_images = excluded.show_images, show_source = excluded.show_source, show_date = excluded.show_date,
  show_description = excluded.show_description, description_lines = excluded.description_lines,
  updated_at = datetime('now');
