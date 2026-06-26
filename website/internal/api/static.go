package api

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
)

// mountStatic serves the embedded SvelteKit build. Unknown non-API, non-asset
// paths fall back to index.html so client-side routing works (SPA fallback).
func (s *Server) mountStatic(r chi.Router) {
	if s.web == nil {
		return
	}
	fileServer := http.FileServer(http.FS(s.web))

	r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
		upath := strings.TrimPrefix(path.Clean("/"+req.URL.Path), "/")
		if upath == "" {
			upath = "index.html"
		}
		if _, err := fs.Stat(s.web, upath); err != nil {
			// Not a real file → serve the SPA shell.
			req2 := req.Clone(req.Context())
			req2.URL.Path = "/"
			serveIndex(w, req2, s.web)
			return
		}
		fileServer.ServeHTTP(w, req)
	})
}

func serveIndex(w http.ResponseWriter, req *http.Request, web fs.FS) {
	data, err := fs.ReadFile(web, "index.html")
	if err != nil {
		http.Error(w, "frontend not built", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}
