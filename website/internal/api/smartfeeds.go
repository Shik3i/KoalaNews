package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

// A custom feed is a saved view: an optional keyword query plus a set of
// selected feeds. Persisted in smart_feeds (+ smart_feed_feeds junction).
type smartFeedView struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Query     string   `json:"query"`
	FeedIDs   []string `json:"feed_ids"`
	CreatedAt string   `json:"created_at"`
}

func (s *Server) toSmartFeedView(r *http.Request, sf sqlcgen.SmartFeed) smartFeedView {
	feedIDs, err := s.store.ListSmartFeedFeedIDs(r.Context(), sf.ID)
	if err != nil || feedIDs == nil {
		feedIDs = []string{} // marshal as [] not null even when empty
	}
	return smartFeedView{ID: sf.ID, Name: sf.Name, Query: sf.Query, FeedIDs: feedIDs, CreatedAt: sf.CreatedAt}
}

func (s *Server) handleListSmartFeeds(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.store.ListSmartFeedsByUser(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	views := make([]smartFeedView, 0, len(rows))
	for _, sf := range rows {
		views = append(views, s.toSmartFeedView(r, sf))
	}
	writeJSON(w, http.StatusOK, views)
}

func (s *Server) handleCreateSmartFeed(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		Name    string   `json:"name"`
		Query   string   `json:"query"`
		FeedIDs []string `json:"feed_ids"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(body.Name)
	query := strings.TrimSpace(body.Query)
	// A custom feed needs a name and at least one signal (feeds and/or a keyword).
	if name == "" || len(name) > 64 || len(query) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "a name (max 64 chars) is required"})
		return
	}
	if len(body.FeedIDs) == 0 && query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "pick at least one feed or enter a keyword"})
		return
	}

	// Validate every selected feed belongs to the user.
	for _, fid := range body.FeedIDs {
		feed, err := s.store.GetFeedByID(r.Context(), fid)
		if err != nil || feed.UserID != u.ID {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "feed not found"})
			return
		}
	}

	sf, err := s.store.CreateSmartFeed(r.Context(), sqlcgen.CreateSmartFeedParams{
		ID: id.New(), Name: name, Query: query, FeedID: nil, UserID: u.ID,
	})
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "a custom feed with this name already exists"})
		return
	}
	for _, fid := range body.FeedIDs {
		if err := s.store.AddSmartFeedFeed(r.Context(), sqlcgen.AddSmartFeedFeedParams{
			SmartFeedID: sf.ID, FeedID: fid,
		}); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save feed selection"})
			return
		}
	}
	writeJSON(w, http.StatusCreated, s.toSmartFeedView(r, sf))
}

func (s *Server) handleDeleteSmartFeed(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	smartFeedID := chi.URLParam(r, "id")
	if err := s.store.DeleteSmartFeedForUser(r.Context(), sqlcgen.DeleteSmartFeedForUserParams{
		ID: smartFeedID, UserID: u.ID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
