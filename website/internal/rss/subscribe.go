package rss

import (
	"context"
	"errors"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

var ErrAlreadySubscribed = errors.New("already subscribed to this feed")

// SubscribeFeed validates the URL, ensures a shared SourceFeed exists, fetches
// its articles, and creates the user's subscription. The SourceFeed is shared
// across users so the same RSS URL is only downloaded and stored once.
func SubscribeFeed(ctx context.Context, store *db.Store, userID, rawURL, languageInput string) (sqlcgen.Feed, error) {
	url, err := NormalizeFeedURL(rawURL)
	if err != nil {
		return sqlcgen.Feed{}, err
	}
	lang := NormalizeLanguage(languageInput)

	if _, err := store.GetUserFeedByURL(ctx, sqlcgen.GetUserFeedByURLParams{UserID: userID, Url: url}); err == nil {
		return sqlcgen.Feed{}, ErrAlreadySubscribed
	}

	sf, err := store.UpsertSourceFeed(ctx, sqlcgen.UpsertSourceFeedParams{
		ID:       id.New(),
		Url:      url,
		Language: lang,
	})
	if err != nil {
		return sqlcgen.Feed{}, err
	}

	// Fetch now: this both validates the feed is parseable and populates articles.
	if _, err := FetchAndStore(ctx, store, sf); err != nil {
		return sqlcgen.Feed{}, err
	}

	// Reload to pick up the title/description discovered during the fetch.
	sf, _ = store.GetSourceFeedByURL(ctx, url)

	return store.CreateFeed(ctx, sqlcgen.CreateFeedParams{
		ID:           id.New(),
		Url:          url,
		Title:        sf.Title,
		Description:  sf.Description,
		Language:     lang,
		UserID:       userID,
		SourceFeedID: &sf.ID,
	})
}
