package rss

import (
	"context"
	"strings"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

// GetOrFetchImage returns a cached image, fetching and caching it on demand if
// it is not yet stored. The URL is SSRF-validated. Returns data + content type.
func GetOrFetchImage(ctx context.Context, store *db.Store, rawURL string) ([]byte, string, error) {
	normalized, err := NormalizeFeedURL(rawURL)
	if err != nil {
		return nil, "", err
	}
	if row, err := store.GetCachedImage(ctx, normalized); err == nil {
		return row.Data, row.ContentType, nil
	}
	data, ct, err := fetchWithLimit(ctx, normalized, userAgent, maxImageBytes, maxRedirects)
	if err != nil {
		return nil, "", err
	}
	if !strings.HasPrefix(ct, "image/") {
		return nil, "", errBlocked
	}
	_ = store.UpsertCachedImage(ctx, sqlcgen.UpsertCachedImageParams{
		SourceUrl:   normalized,
		ContentType: ct,
		Data:        data,
	})
	return data, ct, nil
}

// cacheImages fetches and stores new article images into the image_cache table.
// Failures are best-effort and never abort a sync.
func cacheImages(ctx context.Context, store *db.Store, urls []string) {
	for _, raw := range urls {
		normalized, err := NormalizeFeedURL(raw)
		if err != nil {
			continue
		}
		if _, err := store.GetCachedImage(ctx, normalized); err == nil {
			continue // already cached
		}
		data, ct, err := fetchWithLimit(ctx, normalized, userAgent, maxImageBytes, maxRedirects)
		if err != nil || !strings.HasPrefix(ct, "image/") {
			continue
		}
		_ = store.UpsertCachedImage(ctx, sqlcgen.UpsertCachedImageParams{
			SourceUrl:   normalized,
			ContentType: ct,
			Data:        data,
		})
	}
}
