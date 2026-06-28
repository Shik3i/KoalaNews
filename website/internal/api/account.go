package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/koaladev/koalanews/internal/auth"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

type accountView struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	Name        *string `json:"name"`
	Role        string  `json:"role"`
	HasPassword bool    `json:"hasPassword"`
}

func toAccountView(u sqlcgen.User) accountView {
	return accountView{
		ID: u.ID, Email: u.Email, Name: u.Name, Role: u.Role, HasPassword: u.Password != nil,
	}
}

func (s *Server) handleGetAccount(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	writeJSON(w, http.StatusOK, toAccountView(*u))
}

func (s *Server) handleUpdateAccount(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	name := strings.TrimSpace(body.Name)
	if !emailRe.MatchString(email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email"})
		return
	}

	if existing, err := s.store.GetUserByEmail(r.Context(), email); err == nil && existing.ID != u.ID {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
		return
	}

	var namePtr *string
	if name != "" {
		namePtr = &name
	}
	updated, err := s.store.UpdateUserProfile(r.Context(), sqlcgen.UpdateUserProfileParams{
		Name: namePtr, Email: email, ID: u.ID,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update account"})
		return
	}
	writeJSON(w, http.StatusOK, toAccountView(updated))
}

func (s *Server) handleUpdatePassword(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if len(body.NewPassword) < 8 || len(body.NewPassword) > 512 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "new password must be 8-512 characters"})
		return
	}
	if u.Password != nil && !auth.CheckPassword(*u.Password, body.CurrentPassword) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "current password is incorrect"})
		return
	}
	hash, err := auth.HashPassword(body.NewPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "hash failed"})
		return
	}
	if err := s.store.UpdateUserPassword(r.Context(), sqlcgen.UpdateUserPasswordParams{
		Password: &hash, ID: u.ID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not update password"})
		return
	}

	// Revoke old sessions, then start a fresh current one.
	_ = s.store.DeleteSessionsForUser(r.Context(), u.ID)
	sid, err := auth.CreateSession(r.Context(), s.store, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "session failed"})
		return
	}
	auth.SetSessionCookie(w, r, sid)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
