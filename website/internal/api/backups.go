package api

import (
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/backup"
)

func (s *Server) handleListBackups(w http.ResponseWriter, r *http.Request) {
	backups, err := backup.List(s.dbPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "list failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
}

func (s *Server) handleCreateBackup(w http.ResponseWriter, r *http.Request) {
	backups, err := backup.Create(r.Context(), s.store.DB, s.dbPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "backup failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
}

func (s *Server) handleDownloadBackup(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	path, err := backup.GetPath(s.dbPath, name)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}
