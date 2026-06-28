package api

import (
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/rss"
)

type storyView struct {
	Key      string        `json:"key"`
	Title    string        `json:"title"`
	Count    int           `json:"count"`
	Sources  []string      `json:"sources"`
	Articles []articleView `json:"articles"`
}

type dayView struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

func (s *Server) handleArticlesOverview(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	filter := db.ArticleFilter{
		Query:  strings.TrimSpace(r.URL.Query().Get("q")),
		Sort:   "newest",
		Limit:  200,
		Offset: 0,
	}
	if u != nil && r.URL.Query().Get("scope") != "public" {
		filter.UserID = u.ID
		filter.UnreadOnly = r.URL.Query().Get("unread") == "1" || r.URL.Query().Get("unread") == "true"
		filter.CategoryID = r.URL.Query().Get("category")
		if feedIDs := parseFeedIDs(r); len(feedIDs) > 0 {
			filter.FeedIDs = feedIDs
			filter.CategoryID = ""
		}
		if smartFeedID := r.URL.Query().Get("smartFeed"); smartFeedID != "" && len(filter.FeedIDs) == 0 {
			sf, err := s.store.GetSmartFeedByID(r.Context(), smartFeedID)
			if err == nil && sf.UserID == u.ID {
				filter.FeedIDs, _ = s.store.ListSmartFeedFeedIDs(r.Context(), sf.ID)
				if filter.Query == "" {
					filter.Query = sf.Query
				}
			}
		}
	} else {
		filter.Language = rss.NormalizeLanguage(r.URL.Query().Get("lang"))
	}

	rows, err := s.store.ListArticlesFiltered(r.Context(), filter)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	views := articleFilterViews(rows)
	writeJSON(w, http.StatusOK, map[string]any{
		"topStories": clusterStories(views),
		"days":       summarizeDays(views),
	})
}

func clusterStories(articles []articleView) []storyView {
	type bucket struct {
		key      string
		title    string
		count    int
		articles []articleView
		sources  map[string]struct{}
	}
	buckets := map[string]*bucket{}
	for _, a := range articles {
		if a.Title == nil || strings.TrimSpace(*a.Title) == "" {
			continue
		}
		key := storyKey(*a.Title)
		if key == "" {
			continue
		}
		b := buckets[key]
		if b == nil {
			b = &bucket{key: key, title: *a.Title, sources: map[string]struct{}{}}
			buckets[key] = b
		}
		b.count++
		if len(b.articles) < 4 {
			b.articles = append(b.articles, a)
		}
		if src := articleHost(a); src != "" {
			b.sources[src] = struct{}{}
		}
	}

	stories := make([]storyView, 0, len(buckets))
	for _, b := range buckets {
		if len(b.articles) == 0 {
			continue
		}
		sources := make([]string, 0, len(b.sources))
		for src := range b.sources {
			sources = append(sources, src)
		}
		sort.Strings(sources)
		stories = append(stories, storyView{
			Key: b.key, Title: b.title, Count: b.count, Sources: sources, Articles: b.articles,
		})
	}
	sort.SliceStable(stories, func(i, j int) bool {
		if stories[i].Count != stories[j].Count {
			return stories[i].Count > stories[j].Count
		}
		return storyTime(stories[i]) > storyTime(stories[j])
	})
	if len(stories) > 6 {
		stories = stories[:6]
	}
	return stories
}

func summarizeDays(articles []articleView) []dayView {
	counts := map[string]int{}
	for _, a := range articles {
		day := "unknown"
		if a.PubDate != nil {
			if t, err := time.Parse(time.RFC3339, *a.PubDate); err == nil {
				day = t.Format("2006-01-02")
			}
		}
		counts[day]++
	}
	days := make([]dayView, 0, len(counts))
	for date, count := range counts {
		days = append(days, dayView{Date: date, Count: count})
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Date > days[j].Date })
	if len(days) > 7 {
		days = days[:7]
	}
	return days
}

var storyWordRe = regexp.MustCompile(`[a-z0-9äöüßéèêàçîïôûù]+`)

func storyKey(title string) string {
	words := storyWordRe.FindAllString(strings.ToLower(title), -1)
	out := []string{}
	for _, w := range words {
		if len([]rune(w)) < 4 || storyStopWords[w] {
			continue
		}
		out = append(out, w)
		if len(out) == 8 {
			break
		}
	}
	return strings.Join(out, " ")
}

var storyStopWords = map[string]bool{
	"with": true, "from": true, "that": true, "this": true, "have": true, "will": true,
	"über": true, "nach": true, "auch": true, "eine": true, "einen": true, "dans": true,
	"pour": true, "avec": true, "plus": true,
}

func articleHost(a articleView) string {
	if a.Link == nil {
		return ""
	}
	u, err := url.Parse(*a.Link)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.Hostname(), "www.")
}

func storyTime(s storyView) int64 {
	if len(s.Articles) == 0 || s.Articles[0].PubDate == nil {
		return 0
	}
	t, err := time.Parse(time.RFC3339, *s.Articles[0].PubDate)
	if err != nil {
		return 0
	}
	return t.Unix()
}
