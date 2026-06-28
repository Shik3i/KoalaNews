package api

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/rss"
)

type Server struct {
	store             *db.Store
	web               fs.FS // embedded SvelteKit static build
	dbPath            string
	allowRegistration bool
}

func NewServer(store *db.Store, web fs.FS, dbPath string, allowRegistration bool) *Server {
	return &Server{store: store, web: web, dbPath: dbPath, allowRegistration: allowRegistration}
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
		r.Get("/articles/overview", s.handleArticlesOverview)
		r.Get("/image", s.handleImage)
		r.Get("/statistics", s.handleStatistics)

		r.Post("/auth/register", s.handleRegister)
		r.Post("/auth/login", s.handleLogin)
		r.Post("/auth/logout", s.handleLogout)
		r.Get("/auth/me", s.handleMe)
		r.Get("/account", s.requireAuth(s.handleGetAccount))
		r.Patch("/account", s.requireAuth(s.handleUpdateAccount))
		r.Patch("/account/password", s.requireAuth(s.handleUpdatePassword))

		r.Get("/feeds", s.requireAuth(s.handleListFeeds))
		r.Post("/feeds/discover", s.requireAuth(s.handleDiscoverFeed))
		r.Post("/feeds", s.requireAuth(s.handleCreateFeed))
		r.Delete("/feeds/{id}", s.requireAuth(s.handleDeleteFeed))
		r.Post("/feeds/{id}/refresh", s.requireAuth(s.handleRefreshFeed))
		r.Get("/feeds/opml", s.requireAuth(s.handleOPMLExport))
		r.Post("/feeds/opml/import", s.requireAuth(s.handleOPMLImport))
		r.Patch("/feeds/{id}/category", s.requireAuth(s.handleSetFeedCategory))
		r.Patch("/feeds/{id}/title", s.requireAuth(s.handleRenameFeed))

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
		r.Get("/admin/backups", s.requireAdmin(s.handleListBackups))
		r.Post("/admin/backups", s.requireAdmin(s.handleCreateBackup))
		r.Get("/admin/backups/{name}", s.requireAdmin(s.handleDownloadBackup))
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
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	sort := r.URL.Query().Get("sort")
	unreadOnly := r.URL.Query().Get("unread") == "1" || r.URL.Query().Get("unread") == "true"

	// Logged-in users with subscriptions see their personal feed (with read state);
	// otherwise the public locale feed. `?scope=public` forces the locale feed.
	u := currentUser(r)
	personal := u != nil && r.URL.Query().Get("scope") != "public"

	if personal {
		filter := db.ArticleFilter{
			UserID:     u.ID,
			Query:      query,
			UnreadOnly: unreadOnly,
			Sort:       sort,
			Limit:      int64(limit),
			Offset:     int64(offset),
		}
		// Saved custom feed: optional keyword over a selected set of feeds.
		// An empty selection means "all my feeds" (keyword-only view).
		if smartFeedID := r.URL.Query().Get("smartFeed"); smartFeedID != "" {
			sf, err := s.store.GetSmartFeedByID(r.Context(), smartFeedID)
			if err != nil || sf.UserID != u.ID {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "custom feed not found"})
				return
			}
			feedIDs, err := s.store.ListSmartFeedFeedIDs(r.Context(), sf.ID)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
				return
			}
			if len(feedIDs) == 0 {
				feedIDs, err = s.allUserFeedIDs(r, u.ID)
				if err != nil {
					writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
					return
				}
			}
			filter.FeedIDs = feedIDs
			if filter.Query == "" {
				filter.Query = sf.Query
			}
		}

		// Ad-hoc multi-feed filter: ?feeds=id1,id2 (or legacy single ?feed=id).
		if feedIDs := parseFeedIDs(r); len(feedIDs) > 0 {
			filter.FeedIDs = feedIDs
		}

		if filter.CategoryID = r.URL.Query().Get("category"); filter.CategoryID != "" && len(filter.FeedIDs) > 0 {
			filter.CategoryID = ""
		}

		rows, err := s.store.ListArticlesFiltered(r.Context(), filter)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
			return
		}
		writeJSON(w, http.StatusOK, articleFilterViews(rows))
		return
	}

	rows, err := s.store.ListArticlesFiltered(r.Context(), db.ArticleFilter{
		Language: rss.NormalizeLanguage(r.URL.Query().Get("lang")),
		Query:    query,
		Sort:     sort,
		Limit:    int64(limit),
		Offset:   int64(offset),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	writeJSON(w, http.StatusOK, articleFilterViews(rows))
}

func articleFilterViews(rows []db.ArticleFilterRow) []articleView {
	views := make([]articleView, 0, len(rows))
	for _, a := range rows {
		views = append(views, articleView{
			ID: a.ID, Title: a.Title, Link: a.Link, Description: a.Description,
			Content: a.Content, ImageURL: a.ImageURL, PubDate: a.PubDate, Guid: a.Guid,
			SourceFeedID: a.SourceFeedID, CreatedAt: a.CreatedAt, Read: a.Read,
		})
	}
	return views
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

// parseFeedIDs reads the ad-hoc feed filter from ?feeds=a,b,c (or legacy ?feed=a).
func parseFeedIDs(r *http.Request) []string {
	raw := r.URL.Query().Get("feeds")
	if raw == "" {
		raw = r.URL.Query().Get("feed")
	}
	if raw == "" {
		return nil
	}
	ids := make([]string, 0, 4)
	for _, part := range strings.Split(raw, ",") {
		if p := strings.TrimSpace(part); p != "" {
			ids = append(ids, p)
		}
	}
	return ids
}

// allUserFeedIDs returns every feed id the user subscribes to.
func (s *Server) allUserFeedIDs(r *http.Request, userID string) ([]string, error) {
	feeds, err := s.store.ListFeedsByUser(r.Context(), userID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(feeds))
	for _, f := range feeds {
		ids = append(ids, f.ID)
	}
	return ids, nil
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
