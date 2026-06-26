package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/rss"
)

type feedView struct {
	ID          string  `json:"id"`
	URL         string  `json:"url"`
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Language    string  `json:"language"`
	CreatedAt   string  `json:"created_at"`
}

func toFeedView(f sqlcgen.Feed) feedView {
	return feedView{
		ID: f.ID, URL: f.Url, Title: f.Title, Description: f.Description,
		Language: f.Language, CreatedAt: f.CreatedAt,
	}
}

func (s *Server) handleListFeeds(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	feeds, err := s.store.ListFeedsByUser(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	views := make([]feedView, 0, len(feeds))
	for _, f := range feeds {
		views = append(views, toFeedView(f))
	}
	writeJSON(w, http.StatusOK, views)
}

func (s *Server) handleCreateFeed(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		URL      string `json:"url"`
		Language string `json:"language"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || strings.TrimSpace(body.URL) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "feed url required"})
		return
	}

	feed, err := rss.SubscribeFeed(r.Context(), s.store, u.ID, body.URL, body.Language)
	if err != nil {
		switch {
		case errors.Is(err, rss.ErrAlreadySubscribed):
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already subscribed to this feed"})
		default:
			// Validation / SSRF / parse errors are user-facing 400s.
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "could not add feed: " + err.Error()})
		}
		return
	}
	writeJSON(w, http.StatusCreated, toFeedView(feed))
}

func (s *Server) handleDeleteFeed(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	feedID := chi.URLParam(r, "id")

	feed, err := s.store.GetFeedByID(r.Context(), feedID)
	if err != nil || feed.UserID != u.ID {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "feed not found"})
		return
	}
	if err := s.store.DeleteFeedForUser(r.Context(), sqlcgen.DeleteFeedForUserParams{ID: feedID, UserID: u.ID}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
