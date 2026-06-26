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
		r.Get("/feeds/opml", s.requireAuth(s.handleOPMLExport))
		r.Post("/feeds/opml/import", s.requireAuth(s.handleOPMLImport))
		r.Patch("/feeds/{id}/category", s.requireAuth(s.handleSetFeedCategory))

		r.Get("/categories", s.requireAuth(s.handleListCategories))
		r.Post("/categories", s.requireAuth(s.handleCreateCategory))
		r.Patch("/categories/{id}", s.requireAuth(s.handleRenameCategory))
		r.Delete("/categories/{id}", s.requireAuth(s.handleDeleteCategory))

		r.Get("/smart-feeds", s.requireAuth(s.handleListSmartFeeds))
		r.Post("/smart-feeds", s.requireAuth(s.handleCreateSmartFeed))
		r.Delete("/smart-feeds/{id}", s.requireAuth(s.handleDeleteSmartFeed))

		r.Get("/preferences", s.requireAuth(s.handleGetPreferences))
		r.Put("/preferences", s.requireAuth(s.handlePutPreferences))

		r.Post("/articles/{id}/read", s.requireAuth(s.handleMarkRead))
		r.Delete("/articles/{id}/read", s.requireAuth(s.handleMarkUnread))
		r.Post("/articles/read-all", s.requireAuth(s.handleMarkAllRead))

		r.Get("/admin/users", s.requireAdmin(s.handleAdminListUsers))
		r.Patch("/admin/users/{id}", s.requireAdmin(s.handleAdminUpdateUser))
		r.Get("/admin/stats", s.requireAdmin(s.handleAdminStats))
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

type articleView struct {
	ID           string  `json:"id"`
	Title        *string `json:"title"`
	Link         *string `json:"link"`
	Description  *string `json:"description"`
	Content      *string `json:"content"`
	ImageURL     *string `json:"image_url"`
	PubDate      *string `json:"pub_date"`
	Guid         *string `json:"guid"`
	SourceFeedID *string `json:"source_feed_id"`
	CreatedAt    string  `json:"created_at"`
	Read         bool    `json:"read"`
}

func (s *Server) handleListArticles(w http.ResponseWriter, r *http.Request) {
	limit := clampInt(r.URL.Query().Get("limit"), 30, 1, 100)
	offset := clampInt(r.URL.Query().Get("offset"), 0, 0, 100000)

	// Logged-in users with subscriptions see their personal feed (with read state);
	// otherwise the public locale feed. `?scope=public` forces the locale feed.
	u := currentUser(r)
	personal := u != nil && r.URL.Query().Get("scope") != "public"

	views := []articleView{}
	if personal {
		if smartFeedID := r.URL.Query().Get("smartFeed"); smartFeedID != "" {
			sf, err := s.store.GetSmartFeedByID(r.Context(), smartFeedID)
			if err != nil || sf.UserID != u.ID {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "smart feed not found"})
				return
			}
			rows, err := s.store.ListArticlesForUserBySmartFeed(r.Context(), sqlcgen.ListArticlesForUserBySmartFeedParams{
				ReaderID: u.ID,
				OwnerID:  u.ID,
				FeedID:   feedIDFilter(sf.FeedID),
				FeedId2:  feedIDFilterStr(sf.FeedID),
				Query:    sf.Query,
				Query2:   sf.Query,
				Limit:    int64(limit),
				Offset:   int64(offset),
			})
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
				return
			}
			for _, a := range rows {
				views = append(views, articleView{
					ID: a.ID, Title: a.Title, Link: a.Link, Description: a.Description,
					Content: a.Content, ImageURL: a.ImageUrl, PubDate: a.PubDate, Guid: a.Guid,
					SourceFeedID: a.SourceFeedID, CreatedAt: a.CreatedAt, Read: a.Read != 0,
				})
			}
			writeJSON(w, http.StatusOK, views)
			return
		}

		categoryID := r.URL.Query().Get("category")
		if categoryID != "" {
			rows, err := s.store.ListArticlesForUserByCategory(r.Context(), sqlcgen.ListArticlesForUserByCategoryParams{
				UserID:     u.ID,
				UserID_2:   u.ID,
				CategoryID: &categoryID,
				Limit:      int64(limit),
				Offset:     int64(offset),
			})
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
				return
			}
			for _, a := range rows {
				views = append(views, articleView{
					ID: a.ID, Title: a.Title, Link: a.Link, Description: a.Description,
					Content: a.Content, ImageURL: a.ImageUrl, PubDate: a.PubDate, Guid: a.Guid,
					SourceFeedID: a.SourceFeedID, CreatedAt: a.CreatedAt, Read: a.Read != 0,
				})
			}
			writeJSON(w, http.StatusOK, views)
			return
		}

		rows, err := s.store.ListArticlesForUser(r.Context(), sqlcgen.ListArticlesForUserParams{
			UserID:   u.ID,
			UserID_2: u.ID,
			Limit:    int64(limit),
			Offset:   int64(offset),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
			return
		}
		for _, a := range rows {
			views = append(views, articleView{
				ID: a.ID, Title: a.Title, Link: a.Link, Description: a.Description,
				Content: a.Content, ImageURL: a.ImageUrl, PubDate: a.PubDate, Guid: a.Guid,
				SourceFeedID: a.SourceFeedID, CreatedAt: a.CreatedAt, Read: a.Read != 0,
			})
		}
	} else {
		lang := rss.NormalizeLanguage(r.URL.Query().Get("lang"))
		rows, err := s.store.ListArticlesByLanguage(r.Context(), sqlcgen.ListArticlesByLanguageParams{
			Language: lang,
			Limit:    int64(limit),
			Offset:   int64(offset),
		})
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
			return
		}
		for _, a := range rows {
			views = append(views, articleView{
				ID: a.ID, Title: a.Title, Link: a.Link, Description: a.Description,
				Content: a.Content, ImageURL: a.ImageUrl, PubDate: a.PubDate, Guid: a.Guid,
				SourceFeedID: a.SourceFeedID, CreatedAt: a.CreatedAt, Read: false,
			})
		}
	}
	writeJSON(w, http.StatusOK, views)
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

// feedIDFilter converts an optional feed id into the interface{} sqlc expects
// for the nullable `feed_id IS NULL` comparison.
func feedIDFilter(id *string) interface{} {
	if id == nil {
		return nil
	}
	return *id
}

// feedIDFilterStr mirrors feedIDFilter for the companion `f.id = ?` comparison,
// which is typed as a plain string since f.id is NOT NULL.
func feedIDFilterStr(id *string) string {
	if id == nil {
		return ""
	}
	return *id
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
