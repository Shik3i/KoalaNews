package api

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/rss"
)

type Server struct {
	store *db.Store
	web   fs.FS // embedded SvelteKit static build
}

func NewServer(store *db.Store, web fs.FS) *Server {
	return &Server{store: store, web: web}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Use(s.withUser)
		r.Use(sameOrigin)

		r.Get("/health", s.handleHealth)
		r.Get("/articles", s.handleListArticles)
		r.Get("/image", s.handleImage)

		r.Post("/auth/register", s.handleRegister)
		r.Post("/auth/login", s.handleLogin)
		r.Post("/auth/logout", s.handleLogout)
		r.Get("/auth/me", s.handleMe)

		r.Get("/feeds", s.requireAuth(s.handleListFeeds))
		r.Post("/feeds", s.requireAuth(s.handleCreateFeed))
		r.Delete("/feeds/{id}", s.requireAuth(s.handleDeleteFeed))

		r.Get("/preferences", s.requireAuth(s.handleGetPreferences))
		r.Put("/preferences", s.requireAuth(s.handlePutPreferences))
	})

	// Static frontend (SvelteKit adapter-static) with SPA fallback.
	s.mountStatic(r)
	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DB.PingContext(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db_down"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListArticles(w http.ResponseWriter, r *http.Request) {
	limit := clampInt(r.URL.Query().Get("limit"), 30, 1, 100)
	offset := clampInt(r.URL.Query().Get("offset"), 0, 0, 100000)

	// Logged-in users with subscriptions see their personal feed; otherwise the
	// public locale feed. `?scope=public` forces the locale feed even when signed in.
	u := currentUser(r)
	personal := u != nil && r.URL.Query().Get("scope") != "public"

	var articles []sqlcgen.Article
	var err error
	if personal {
		articles, err = s.store.ListArticlesForUser(r.Context(), sqlcgen.ListArticlesForUserParams{
			UserID: u.ID,
			Limit:  int64(limit),
			Offset: int64(offset),
		})
	} else {
		lang := rss.NormalizeLanguage(r.URL.Query().Get("lang"))
		articles, err = s.store.ListArticlesByLanguage(r.Context(), sqlcgen.ListArticlesByLanguageParams{
			Language: lang,
			Limit:    int64(limit),
			Offset:   int64(offset),
		})
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	if articles == nil {
		articles = []sqlcgen.Article{}
	}
	writeJSON(w, http.StatusOK, articles)
}

func (s *Server) handleImage(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("url")
	if raw == "" {
		http.Error(w, "missing url", http.StatusBadRequest)
		return
	}
	data, ct, err := rss.GetOrFetchImage(r.Context(), s.store, raw)
	if err != nil {
		http.Error(w, "image unavailable", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "public, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func clampInt(s string, def, min, max int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	if n < min {
		return min
	}
	if n > max {
		return max
	}
	return n
}
