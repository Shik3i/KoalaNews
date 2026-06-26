package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

type smartFeedView struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Query     string  `json:"query"`
	FeedID    *string `json:"feed_id"`
	CreatedAt string  `json:"created_at"`
}

func toSmartFeedView(sf sqlcgen.SmartFeed) smartFeedView {
	return smartFeedView{ID: sf.ID, Name: sf.Name, Query: sf.Query, FeedID: sf.FeedID, CreatedAt: sf.CreatedAt}
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
		views = append(views, toSmartFeedView(sf))
	}
	writeJSON(w, http.StatusOK, views)
}

func (s *Server) handleCreateSmartFeed(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		Name   string  `json:"name"`
		Query  string  `json:"query"`
		FeedID *string `json:"feed_id"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(body.Name)
	query := strings.TrimSpace(body.Query)
	if name == "" || len(name) > 64 || query == "" || len(query) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and query are required"})
		return
	}

	if body.FeedID != nil && *body.FeedID != "" {
		feed, err := s.store.GetFeedByID(r.Context(), *body.FeedID)
		if err != nil || feed.UserID != u.ID {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "feed not found"})
			return
		}
	} else {
		body.FeedID = nil
	}

	sf, err := s.store.CreateSmartFeed(r.Context(), sqlcgen.CreateSmartFeedParams{
		ID: id.New(), Name: name, Query: query, FeedID: body.FeedID, UserID: u.ID,
	})
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "smart feed already exists"})
		return
	}
	writeJSON(w, http.StatusCreated, toSmartFeedView(sf))
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
