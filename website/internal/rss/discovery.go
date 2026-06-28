package rss

import (
	"bytes"
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/mmcdole/gofeed"
)

type FeedCandidate struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func DiscoverFeeds(ctx context.Context, rawURL string) ([]FeedCandidate, error) {
	start, err := NormalizeFeedURL(rawURL)
	if err != nil {
		return nil, err
	}
	body, contentType, err := fetchWithLimit(ctx, start, userAgent, maxFeedBytes, maxRedirects)
	if err != nil {
		return nil, err
	}

	if c, ok := parseFeedCandidate(start, body); ok {
		return []FeedCandidate{c}, nil
	}
	if !strings.Contains(strings.ToLower(contentType), "html") && !looksHTML(body) {
		return nil, errors.New("no feed found")
	}

	candidates := []FeedCandidate{}
	seen := map[string]struct{}{}
	for _, href := range alternateFeedHrefs(string(body)) {
		resolved, err := resolveRedirect(start, href)
		if err != nil {
			continue
		}
		normalized, err := NormalizeFeedURL(resolved)
		if err != nil {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		feedBody, _, err := fetchWithLimit(ctx, normalized, userAgent, maxFeedBytes, maxRedirects)
		if err != nil {
			continue
		}
		if c, ok := parseFeedCandidate(normalized, feedBody); ok {
			candidates = append(candidates, c)
		}
		if len(candidates) == 5 {
			break
		}
	}
	return candidates, nil
}

func parseFeedCandidate(url string, body []byte) (FeedCandidate, bool) {
	parsed, err := gofeed.NewParser().Parse(bytes.NewReader(body))
	if err != nil {
		return FeedCandidate{}, false
	}
	return FeedCandidate{URL: url, Title: parsed.Title, Description: parsed.Description}, true
}

func looksHTML(body []byte) bool {
	s := strings.ToLower(string(body[:min(len(body), 512)]))
	return strings.Contains(s, "<html") || strings.Contains(s, "<!doctype html")
}

var linkTagRe = regexp.MustCompile(`(?is)<link\s+[^>]*>`)
var attrRe = regexp.MustCompile(`(?is)([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`)

func alternateFeedHrefs(html string) []string {
	out := []string{}
	for _, tag := range linkTagRe.FindAllString(html, -1) {
		attrs := map[string]string{}
		for _, m := range attrRe.FindAllStringSubmatch(tag, -1) {
			value := m[3]
			if value == "" {
				value = m[4]
			}
			if value == "" {
				value = m[5]
			}
			attrs[strings.ToLower(m[1])] = value
		}
		rel := strings.ToLower(attrs["rel"])
		typ := strings.ToLower(attrs["type"])
		href := strings.TrimSpace(attrs["href"])
		if href == "" || !strings.Contains(rel, "alternate") {
			continue
		}
		if strings.Contains(typ, "rss") || strings.Contains(typ, "atom") || strings.Contains(typ, "xml") {
			out = append(out, href)
		}
	}
	return out
}
