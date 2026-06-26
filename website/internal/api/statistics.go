package api

import "net/http"

type topFeedView struct {
	Title        *string `json:"title"`
	URL          string  `json:"url"`
	ArticleCount int64   `json:"articleCount"`
}

// handleStatistics serves sitewide totals (no auth) — distinct from the
// admin stats panel, which requires admin and includes DB size/users.
func (s *Server) handleStatistics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, _ := s.store.CountUsers(ctx)
	sources, _ := s.store.CountSourceFeeds(ctx)
	articles, _ := s.store.CountArticles(ctx)

	rows, err := s.store.TopSourceFeedsByArticleCount(ctx, 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	topFeeds := make([]topFeedView, 0, len(rows))
	for _, row := range rows {
		topFeeds = append(topFeeds, topFeedView{Title: row.Title, URL: row.Url, ArticleCount: row.ArticleCount})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"users":    users,
		"feeds":    sources,
		"articles": articles,
		"topFeeds": topFeeds,
	})
}
