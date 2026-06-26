package db

import (
	"context"
	"strings"

	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

// ListArticlesByFeedIDs returns a user's articles restricted to the given feed
// IDs, optionally keyword-filtered on title/description (empty query = no filter).
//
// This is the ONLY hand-built query in the codebase: a dynamic `IN (?, ?, …)`
// list cannot be expressed as a static sqlc query, and mixing sqlc.slice with
// named args reintroduces the placeholder-numbering hazard already hit once with
// the smart-feed query. Placeholders are positional and ordered to match args.
func (s *Store) ListArticlesByFeedIDs(
	ctx context.Context,
	readerID, ownerID string,
	feedIDs []string,
	query string,
	limit, offset int64,
) ([]sqlcgen.ListArticlesForUserByFeedRow, error) {
	if len(feedIDs) == 0 {
		return []sqlcgen.ListArticlesForUserByFeedRow{}, nil
	}

	placeholders := make([]string, len(feedIDs))
	// arg order must match the `?` order in the SQL below.
	args := make([]any, 0, len(feedIDs)+7)
	args = append(args, readerID) // read-state subquery: ar.user_id
	args = append(args, ownerID)  // feeds.user_id
	for i, id := range feedIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	like := "%" + strings.ToLower(query) + "%"
	args = append(args, query, like, like, limit, offset)

	sqlStr := `SELECT DISTINCT a.id, a.title, a.link, a.description, a.content, a.image_url,
  a.pub_date, a.guid, a.source_feed_id, a.created_at,
  CASE WHEN EXISTS(
    SELECT 1 FROM article_reads ar WHERE ar.user_id = ? AND ar.article_id = a.id
  ) THEN 1 ELSE 0 END AS read
FROM articles a
JOIN feeds f ON f.source_feed_id = a.source_feed_id
WHERE f.user_id = ? AND f.id IN (` + strings.Join(placeholders, ",") + `)
  AND (? = '' OR LOWER(a.title) LIKE ? OR LOWER(a.description) LIKE ?)
ORDER BY a.pub_date DESC NULLS LAST, a.created_at DESC
LIMIT ? OFFSET ?`

	rows, err := s.DB.QueryContext(ctx, sqlStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []sqlcgen.ListArticlesForUserByFeedRow
	for rows.Next() {
		var i sqlcgen.ListArticlesForUserByFeedRow
		if err := rows.Scan(
			&i.ID, &i.Title, &i.Link, &i.Description, &i.Content, &i.ImageUrl,
			&i.PubDate, &i.Guid, &i.SourceFeedID, &i.CreatedAt, &i.Read,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
