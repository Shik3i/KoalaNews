package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

type categoryView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
}

func toCategoryView(c sqlcgen.Category) categoryView {
	return categoryView{ID: c.ID, Name: c.Name, CreatedAt: c.CreatedAt}
}

func (s *Server) handleListCategories(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.store.ListCategoriesByUser(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	views := make([]categoryView, 0, len(rows))
	for _, c := range rows {
		views = append(views, toCategoryView(c))
	}
	writeJSON(w, http.StatusOK, views)
}

func (s *Server) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len(name) > 64 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name must be 1-64 characters"})
		return
	}

	cat, err := s.store.CreateCategory(r.Context(), sqlcgen.CreateCategoryParams{
		ID: id.New(), Name: name, UserID: u.ID,
	})
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "category already exists"})
		return
	}
	writeJSON(w, http.StatusCreated, toCategoryView(cat))
}

func (s *Server) handleRenameCategory(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	catID := chi.URLParam(r, "id")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" || len(name) > 64 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name must be 1-64 characters"})
		return
	}
	if err := s.store.RenameCategory(r.Context(), sqlcgen.RenameCategoryParams{
		Name: name, ID: catID, UserID: u.ID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "rename failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleDeleteCategory(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	catID := chi.URLParam(r, "id")
	if err := s.store.DeleteCategoryForUser(r.Context(), sqlcgen.DeleteCategoryForUserParams{
		ID: catID, UserID: u.ID,
	}); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete failed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
