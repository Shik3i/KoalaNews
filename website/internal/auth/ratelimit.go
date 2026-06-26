package auth

import (
	"context"
	"time"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

// Allow reports whether an action under `key` is within `limit` per `window`.
// It is DB-backed so limits survive restarts and work across instances.
func Allow(ctx context.Context, store *db.Store, key string, limit int, window time.Duration) bool {
	now := time.Now().UTC()
	row, err := store.GetRateLimit(ctx, key)
	if err != nil {
		// No entry yet → start a fresh window.
		_ = store.SetRateLimit(ctx, sqlcgen.SetRateLimitParams{
			Key:     key,
			Count:   1,
			ResetAt: now.Add(window).Format(sqliteTimeFmt),
		})
		return true
	}

	reset, perr := time.Parse(sqliteTimeFmt, row.ResetAt)
	if perr != nil || now.After(reset) {
		_ = store.SetRateLimit(ctx, sqlcgen.SetRateLimitParams{
			Key:     key,
			Count:   1,
			ResetAt: now.Add(window).Format(sqliteTimeFmt),
		})
		return true
	}

	if row.Count >= int64(limit) {
		return false
	}
	_ = store.SetRateLimit(ctx, sqlcgen.SetRateLimitParams{
		Key:     key,
		Count:   row.Count + 1,
		ResetAt: row.ResetAt,
	})
	return true
}
