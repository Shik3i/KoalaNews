package api

import (
	"context"
	"net/http"
	"net/url"

	"github.com/koaladev/koalanews/internal/auth"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

type ctxKey int

const userKey ctxKey = iota

// withUser attaches the authenticated user (if any) to the request context.
func (s *Server) withUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if u, err := auth.UserForRequest(r.Context(), s.store, r); err == nil {
			r = r.WithContext(context.WithValue(r.Context(), userKey, &u))
		}
		next.ServeHTTP(w, r)
	})
}

// requireAuth rejects requests without an authenticated user.
func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if currentUser(r) == nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
			return
		}
		next(w, r)
	}
}

// requireAdmin rejects non-admin users.
func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		if u := currentUser(r); u == nil || u.Role != "ADMIN" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin required"})
			return
		}
		next(w, r)
	})
}

// sameOrigin blocks cross-site mutating requests (CSRF protection for cookie auth).
func sameOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}
		origin := r.Header.Get("Origin")
		if origin != "" {
			u, err := url.Parse(origin)
			if err != nil || u.Host != requestHost(r) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "cross-origin request blocked"})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func requestHost(r *http.Request) string {
	if h := r.Header.Get("X-Forwarded-Host"); h != "" {
		return h
	}
	return r.Host
}

func currentUser(r *http.Request) *sqlcgen.User {
	u, _ := r.Context().Value(userKey).(*sqlcgen.User)
	return u
}
