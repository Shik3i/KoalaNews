package rss

import (
	"bytes"
	"context"
	"strings"
	"time"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
	"github.com/mmcdole/gofeed"
)

const (
	maxFeedBytes  = 2 * 1024 * 1024
	maxImageBytes = 3 * 1024 * 1024
	maxRedirects  = 3
	userAgent     = "KoalaNews/1.0"
	maxNewImages  = 12
)

// DefaultFeeds mirrors the locale defaults of the legacy app.
var DefaultFeeds = map[string]struct{ Title, URL string }{
	"de": {"Tagesschau", "https://www.tagesschau.de/xml/rss2/"},
	"en": {"BBC News", "https://feeds.bbci.co.uk/news/rss.xml"},
	"fr": {"BFMTV", "https://www.bfmtv.com/rss/news-24-7/"},
}

func NormalizeLanguage(v string) string {
	switch v {
	case "de", "fr":
		return v
	default:
		return "en"
	}
}

// FetchAndStore fetches a source feed, parses it, and inserts new (deduplicated)
// articles for the given source feed id. It returns the number of new articles.
func FetchAndStore(ctx context.Context, store *db.Store, sf sqlcgen.SourceFeed) (int, error) {
	body, _, err := fetchWithLimit(ctx, sf.Url, userAgent, maxFeedBytes, maxRedirects)
	if err != nil {
		return 0, err
	}

	parsed, err := gofeed.NewParser().Parse(bytes.NewReader(body))
	if err != nil {
		return 0, err
	}

	title := parsed.Title
	desc := parsed.Description
	if err := store.UpdateSourceFeedMeta(ctx, sqlcgen.UpdateSourceFeedMetaParams{
		Title:       strPtr(title),
		Description: strPtr(desc),
		Language:    sf.Language,
		ID:          sf.ID,
	}); err != nil {
		return 0, err
	}

	existing, err := store.ListExistingGuids(ctx, &sf.ID)
	if err != nil {
		return 0, err
	}
	seen := make(map[string]struct{}, len(existing))
	for _, g := range existing {
		if g != nil {
			seen[*g] = struct{}{}
		}
	}

	var newImages []string
	inserted := 0
	for _, item := range parsed.Items {
		guid := item.GUID
		if guid == "" {
			guid = item.Link
		}
		if guid == "" {
			continue
		}
		if _, ok := seen[guid]; ok {
			continue
		}
		seen[guid] = struct{}{}

		imageURL := extractImage(item)
		if imageURL != "" && len(newImages) < maxNewImages {
			newImages = append(newImages, imageURL)
		}

		err := store.InsertArticle(ctx, sqlcgen.InsertArticleParams{
			ID:           id.New(),
			Title:        strPtr(item.Title),
			Link:         strPtr(item.Link),
			Description:  strPtr(snippet(item)),
			Content:      strPtr(item.Content),
			ImageUrl:     strPtr(imageURL),
			PubDate:      pubDate(item),
			Guid:         &guid,
			SourceFeedID: &sf.ID,
		})
		if err != nil {
			return inserted, err
		}
		inserted++
	}

	cacheImages(ctx, store, newImages)
	return inserted, nil
}

func extractImage(item *gofeed.Item) string {
	if item.Image != nil && item.Image.URL != "" {
		return item.Image.URL
	}
	for _, enc := range item.Enclosures {
		if enc != nil && enc.URL != "" && strings.HasPrefix(enc.Type, "image/") {
			return enc.URL
		}
	}
	// media:content / media:thumbnail via the media extension namespace.
	if media, ok := item.Extensions["media"]; ok {
		for _, key := range []string{"content", "thumbnail"} {
			for _, ext := range media[key] {
				if u := ext.Attrs["url"]; u != "" {
					return u
				}
			}
		}
	}
	if html := item.Content; html != "" {
		if u := firstImgSrc(html); u != "" {
			return u
		}
	}
	return ""
}

func firstImgSrc(html string) string {
	lower := strings.ToLower(html)
	i := strings.Index(lower, "<img")
	if i < 0 {
		return ""
	}
	rest := html[i:]
	si := strings.Index(strings.ToLower(rest), "src=")
	if si < 0 {
		return ""
	}
	rest = rest[si+4:]
	if rest == "" {
		return ""
	}
	quote := rest[0]
	if quote != '"' && quote != '\'' {
		return ""
	}
	end := strings.IndexByte(rest[1:], quote)
	if end < 0 {
		return ""
	}
	return rest[1 : end+1]
}

func snippet(item *gofeed.Item) string {
	if item.Description != "" {
		return item.Description
	}
	return item.Content
}

func pubDate(item *gofeed.Item) *string {
	if item.PublishedParsed != nil {
		s := item.PublishedParsed.UTC().Format(time.RFC3339)
		return &s
	}
	return nil
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
