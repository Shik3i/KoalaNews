package db

import (
	"context"
	"database/sql"
	"strings"
)

type ArticleFilter struct {
	UserID     string
	Language   string
	CategoryID string
	FeedIDs    []string
	Query      string
	UnreadOnly bool
	Sort       string
	Limit      int64
	Offset     int64
}

type ArticleFilterRow struct {
	ID           string
	Title        *string
	Link         *string
	Description  *string
	Content      *string
	ImageURL     *string
	PubDate      *string
	Guid         *string
	SourceFeedID *string
	CreatedAt    string
	Read         bool
}

func (s *Store) ListArticlesFiltered(ctx context.Context, f ArticleFilter) ([]ArticleFilterRow, error) {
	if f.Limit <= 0 {
		f.Limit = 30
	}
	var b strings.Builder
	args := []any{}

	readExpr := "0"
	if f.UserID != "" {
		readExpr = "CASE WHEN EXISTS(SELECT 1 FROM article_reads ar WHERE ar.user_id = ? AND ar.article_id = a.id) THEN 1 ELSE 0 END"
		args = append(args, f.UserID)
	}
	b.WriteString(`WITH filtered AS (
SELECT a.id, a.title, a.link, a.description, a.content, a.image_url,
  a.pub_date, a.guid, a.source_feed_id, a.created_at, `)
	b.WriteString(readExpr)
	b.WriteString(` AS read,
  ROW_NUMBER() OVER (
    PARTITION BY CASE
      WHEN NULLIF(TRIM(COALESCE(a.title, '')), '') IS NOT NULL THEN 'title:' || LOWER(TRIM(a.title))
      WHEN NULLIF(TRIM(COALESCE(a.link, '')), '') IS NOT NULL THEN 'link:' || LOWER(TRIM(a.link))
      WHEN NULLIF(TRIM(COALESCE(a.guid, '')), '') IS NOT NULL THEN 'guid:' || LOWER(TRIM(a.guid))
      ELSE a.id
    END
    ORDER BY a.pub_date DESC NULLS LAST, a.created_at DESC, a.id ASC
  ) AS duplicate_rank`)
	if f.UserID != "" {
		b.WriteString(", LOWER(COALESCE(f.custom_title, f.title, f.url)) AS source_sort")
	} else {
		b.WriteString(", LOWER(COALESCE(sf.title, sf.url)) AS source_sort")
	}
	b.WriteString(`
FROM articles a
`)

	where := []string{}
	if f.UserID != "" {
		b.WriteString("JOIN feeds f ON f.source_feed_id = a.source_feed_id\n")
		where = append(where, "f.user_id = ?")
		args = append(args, f.UserID)
		if f.CategoryID != "" {
			where = append(where, "f.category_id = ?")
			args = append(args, f.CategoryID)
		}
		if len(f.FeedIDs) > 0 {
			placeholders := make([]string, len(f.FeedIDs))
			for i, id := range f.FeedIDs {
				placeholders[i] = "?"
				args = append(args, id)
			}
			where = append(where, "f.id IN ("+strings.Join(placeholders, ",")+")")
		}
		if f.UnreadOnly {
			where = append(where, "NOT EXISTS(SELECT 1 FROM article_reads ar WHERE ar.user_id = ? AND ar.article_id = a.id)")
			args = append(args, f.UserID)
		}
	} else {
		b.WriteString("JOIN source_feeds sf ON sf.id = a.source_feed_id\n")
		where = append(where, "sf.language = ?")
		args = append(args, f.Language)
	}

	if q := strings.TrimSpace(f.Query); q != "" {
		where = append(where, `(LOWER(COALESCE(a.title, '')) LIKE '%' || LOWER(?) || '%'
 OR LOWER(COALESCE(a.description, '')) LIKE '%' || LOWER(?) || '%'
 OR LOWER(COALESCE(a.content, '')) LIKE '%' || LOWER(?) || '%')`)
		args = append(args, q, q, q)
	}

	if len(where) > 0 {
		b.WriteString("WHERE ")
		b.WriteString(strings.Join(where, "\n  AND "))
		b.WriteByte('\n')
	}
	b.WriteString(")\n")
	b.WriteString(`SELECT id, title, link, description, content, image_url, pub_date, guid, source_feed_id, created_at, read
FROM filtered
WHERE duplicate_rank = 1
`)

	switch f.Sort {
	case "oldest":
		b.WriteString("ORDER BY pub_date ASC NULLS LAST, created_at ASC\n")
	case "title":
		b.WriteString("ORDER BY LOWER(COALESCE(title, '')) ASC, pub_date DESC NULLS LAST\n")
	case "source":
		b.WriteString("ORDER BY source_sort ASC, pub_date DESC NULLS LAST\n")
	default:
		b.WriteString("ORDER BY pub_date DESC NULLS LAST, created_at DESC\n")
	}

	b.WriteString("LIMIT ? OFFSET ?")
	args = append(args, f.Limit, f.Offset)

	rows, err := s.DB.QueryContext(ctx, b.String(), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ArticleFilterRow{}
	for rows.Next() {
		var r ArticleFilterRow
		var title, link, desc, content, image, pub, guid, source sql.NullString
		var read int64
		if err := rows.Scan(
			&r.ID, &title, &link, &desc, &content, &image, &pub, &guid, &source, &r.CreatedAt, &read,
		); err != nil {
			return nil, err
		}
		r.Title = nullString(title)
		r.Link = nullString(link)
		r.Description = nullString(desc)
		r.Content = nullString(content)
		r.ImageURL = nullString(image)
		r.PubDate = nullString(pub)
		r.Guid = nullString(guid)
		r.SourceFeedID = nullString(source)
		r.Read = read != 0
		out = append(out, r)
	}
	return out, rows.Err()
}

func nullString(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}
