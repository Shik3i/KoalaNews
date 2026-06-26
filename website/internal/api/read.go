package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

func (s *Server) handleMarkRead(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	articleID := chi.URLParam(r, "id")
	if err := s.store.MarkArticleRead(r.Context(), sqlcgen.MarkArticleReadParams{
		UserID: u.ID, ArticleID: articleID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not mark read"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMarkUnread(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	articleID := chi.URLParam(r, "id")
	if err := s.store.MarkArticleUnread(r.Context(), sqlcgen.MarkArticleUnreadParams{
		UserID: u.ID, ArticleID: articleID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not mark unread"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMarkAllRead(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if err := s.store.MarkAllReadForUser(r.Context(), sqlcgen.MarkAllReadForUserParams{
		UserID: u.ID, UserID_2: u.ID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not mark all read"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
