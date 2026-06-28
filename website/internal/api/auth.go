package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/koaladev/koalanews/internal/auth"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type userView struct {
	ID    string  `json:"id"`
	Email string  `json:"email"`
	Name  *string `json:"name"`
	Role  string  `json:"role"`
}

func toUserView(u sqlcgen.User) userView {
	return userView{ID: u.ID, Email: u.Email, Name: u.Name, Role: u.Role}
}

func decodeCreds(r *http.Request) (credentials, bool) {
	var c credentials
	if err := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 4096)).Decode(&c); err != nil {
		return c, false
	}
	c.Email = strings.ToLower(strings.TrimSpace(c.Email))
	c.Name = strings.TrimSpace(c.Name)
	return c, true
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if !s.allowRegistration {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "registration disabled"})
		return
	}

	c, ok := decodeCreds(r)
	if !ok || !emailRe.MatchString(c.Email) || len(c.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid email or password too short (min 8)"})
		return
	}
	if !auth.Allow(r.Context(), s.store, "register:"+clientIP(r), 5, time.Hour) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many attempts"})
		return
	}

	if _, err := s.store.GetUserByEmail(r.Context(), c.Email); err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "email already registered"})
		return
	}

	hash, err := auth.HashPassword(c.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "hash failed"})
		return
	}

	// First user bootstraps as ADMIN.
	role := "USER"
	if n, err := s.store.CountUsers(r.Context()); err == nil && n == 0 {
		role = "ADMIN"
	}

	var namePtr *string
	if c.Name != "" {
		namePtr = &c.Name
	}
	user, err := s.store.CreateUser(r.Context(), sqlcgen.CreateUserParams{
		ID:       id.New(),
		Name:     namePtr,
		Email:    c.Email,
		Password: &hash,
		Role:     role,
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not create user"})
		return
	}
	_ = s.store.CreateUserPreference(r.Context(), user.ID)

	s.startSession(w, r, user)
	writeJSON(w, http.StatusCreated, toUserView(user))
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	c, ok := decodeCreds(r)
	if !ok || c.Email == "" || c.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email and password required"})
		return
	}
	if !auth.Allow(r.Context(), s.store, "login-ip:"+clientIP(r), 10, time.Minute) ||
		!auth.Allow(r.Context(), s.store, "login-email:"+c.Email, 20, 15*time.Minute) {
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many attempts"})
		return
	}

	user, err := s.store.GetUserByEmail(r.Context(), c.Email)
	if err != nil || user.Password == nil || user.Banned != 0 || !auth.CheckPassword(*user.Password, c.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	s.startSession(w, r, user)
	writeJSON(w, http.StatusOK, toUserView(user))
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(auth.CookieName); err == nil {
		_ = s.store.DeleteSession(r.Context(), c.Value)
	}
	auth.ClearSessionCookie(w, r)
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if u == nil {
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toUserView(*u)})
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, user sqlcgen.User) {
	sid, err := auth.CreateSession(r.Context(), s.store, user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "session failed"})
		return
	}
	auth.SetSessionCookie(w, r, sid)
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	return r.RemoteAddr
}
