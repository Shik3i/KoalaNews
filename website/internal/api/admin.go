package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

type adminUserView struct {
	ID           string  `json:"id"`
	Name         *string `json:"name"`
	Email        string  `json:"email"`
	Role         string  `json:"role"`
	Banned       bool    `json:"banned"`
	BannedReason *string `json:"bannedReason"`
	CreatedAt    string  `json:"createdAt"`
}

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.store.ListUsers(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	out := make([]adminUserView, 0, len(rows))
	for _, u := range rows {
		out = append(out, adminUserView{
			ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role,
			Banned: u.Banned != 0, BannedReason: u.BannedReason, CreatedAt: u.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	me := currentUser(r)
	targetID := chi.URLParam(r, "id")

	var body struct {
		Role         *string `json:"role"`
		Banned       *bool   `json:"banned"`
		BannedReason *string `json:"bannedReason"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}

	target, err := s.store.GetUserByID(r.Context(), targetID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	// Self-lockout protection: admins cannot ban themselves or drop their own admin role.
	if target.ID == me.ID {
		if (body.Banned != nil && *body.Banned) || (body.Role != nil && *body.Role != "ADMIN") {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "you cannot ban or demote yourself"})
			return
		}
	}

	role := target.Role
	if body.Role != nil && (*body.Role == "ADMIN" || *body.Role == "USER") {
		role = *body.Role
	}
	banned := target.Banned
	reason := target.BannedReason
	if body.Banned != nil {
		if *body.Banned {
			banned = 1
			reason = body.BannedReason
		} else {
			banned = 0
			reason = nil
		}
	}

	if err := s.store.SetUserRoleBanned(r.Context(), sqlcgen.SetUserRoleBannedParams{
		Role: role, Banned: banned, BannedReason: reason, ID: targetID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "update failed"})
		return
	}

	// Revoke sessions when banning so the user is kicked out immediately.
	if banned == 1 {
		_ = s.store.DeleteSessionsForUser(r.Context(), targetID)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAdminStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, _ := s.store.CountUsers(ctx)
	feeds, _ := s.store.CountFeeds(ctx)
	sources, _ := s.store.CountSourceFeeds(ctx)
	articles, _ := s.store.CountArticles(ctx)

	// Database size on disk via SQLite pragmas (page_count * page_size).
	var dbBytes int64
	_ = s.store.DB.QueryRowContext(ctx,
		"SELECT (SELECT page_count FROM pragma_page_count) * (SELECT page_size FROM pragma_page_size)").
		Scan(&dbBytes)

	writeJSON(w, http.StatusOK, map[string]any{
		"users":       users,
		"feeds":       feeds,
		"sourceFeeds": sources,
		"articles":    articles,
		"dbBytes":     dbBytes,
	})
}
