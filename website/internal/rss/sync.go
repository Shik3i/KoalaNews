package rss

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

// EnsureDefaultFeeds seeds the locale default source feeds if they don't exist yet,
// so the public feed page has content on a fresh install.
func EnsureDefaultFeeds(ctx context.Context, store *db.Store) error {
	for lang, def := range DefaultFeeds {
		url, err := NormalizeFeedURL(def.URL)
		if err != nil {
			return err
		}
		if _, err := store.UpsertSourceFeed(ctx, sqlcgen.UpsertSourceFeedParams{
			ID:       id.New(),
			Url:      url,
			Language: lang,
		}); err != nil {
			return err
		}
	}
	return nil
}

// SyncOnce fetches every source feed that is due (older than the sync interval).
func SyncOnce(ctx context.Context, store *db.Store, interval time.Duration) {
	// "-15 minutes" style modifier for the SQLite datetime comparison.
	modifier := fmt.Sprintf("-%d seconds", int(interval.Seconds()))
	feeds, err := store.ListSourceFeedsToSync(ctx, modifier)
	if err != nil {
		slog.Error("sync: list source feeds", "err", err)
		return
	}
	for _, sf := range feeds {
		n, err := FetchAndStore(ctx, store, sf)
		if err != nil {
			slog.Warn("sync: fetch feed failed", "url", sf.Url, "err", err)
			continue
		}
		if n > 0 {
			slog.Info("sync: stored articles", "url", sf.Url, "new", n)
		}
	}
}

// RunWorker runs SyncOnce immediately, then on every tick until ctx is cancelled.
func RunWorker(ctx context.Context, store *db.Store, interval time.Duration) {
	slog.Info("rss worker started", "interval", interval)
	SyncOnce(ctx, store, interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("rss worker stopped")
			return
		case <-ticker.C:
			SyncOnce(ctx, store, interval)
		}
	}
}
