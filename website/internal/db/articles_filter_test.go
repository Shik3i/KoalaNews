package db

import (
	"context"
	"path/filepath"
	"testing"
)

func TestListArticlesFilteredDeduplicatesTitles(t *testing.T) {
	ctx := context.Background()
	store, err := Open(ctx, filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if _, err := store.DB.ExecContext(ctx, `
INSERT INTO source_feeds (id, url, title, language) VALUES ('feed', 'https://example.com/rss', 'Example', 'en');
INSERT INTO articles (id, title, link, pub_date, guid, source_feed_id, created_at) VALUES
  ('old', 'Same headline', 'https://example.com/old', '2026-06-28T10:00:00Z', 'old-guid', 'feed', '2026-06-28 10:00:00'),
  ('new', 'Same headline', 'https://example.com/new', '2026-06-29T10:00:00Z', 'new-guid', 'feed', '2026-06-29 10:00:00'),
  ('other', 'Different headline', 'https://example.com/other', '2026-06-29T09:00:00Z', 'other-guid', 'feed', '2026-06-29 09:00:00');
`); err != nil {
		t.Fatal(err)
	}

	rows, err := store.ListArticlesFiltered(ctx, ArticleFilter{Language: "en", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 {
		t.Fatalf("got %d rows, want 2", len(rows))
	}
	if rows[0].ID != "new" {
		t.Fatalf("kept %q, want newest duplicate", rows[0].ID)
	}
}
