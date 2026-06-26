package api

import (
	"encoding/json"
	"net/http"

	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

// prefsView is the appearance shape the SvelteKit frontend speaks (camelCase).
type prefsView struct {
	Theme           string `json:"theme"`
	Accent          string `json:"accent"`
	CardStyle       string `json:"cardStyle"`
	Density         string `json:"density"`
	FontScale       string `json:"fontScale"`
	ShowImages      bool   `json:"showImages"`
	ShowSource      bool   `json:"showSource"`
	ShowDate        bool   `json:"showDate"`
	ShowDescription bool   `json:"showDescription"`
}

func defaultPrefs() prefsView {
	return prefsView{
		Theme: "system", Accent: "#2563eb", CardStyle: "magazine",
		Density: "comfortable", FontScale: "medium",
		ShowImages: true, ShowSource: true, ShowDate: true, ShowDescription: true,
	}
}

func toPrefsView(p sqlcgen.UserPreference) prefsView {
	return prefsView{
		Theme:           p.Theme,
		Accent:          p.AccentColor,
		CardStyle:       p.CardStyle,
		Density:         p.Density,
		FontScale:       p.FontScale,
		ShowImages:      p.ShowImages != 0,
		ShowSource:      p.ShowSource != 0,
		ShowDate:        p.ShowDate != 0,
		ShowDescription: p.ShowDescription != 0,
	}
}

func boolToInt(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func (s *Server) handleGetPreferences(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	p, err := s.store.GetUserPreference(r.Context(), u.ID)
	if err != nil {
		// No row yet → return defaults rather than erroring.
		writeJSON(w, http.StatusOK, defaultPrefs())
		return
	}
	writeJSON(w, http.StatusOK, toPrefsView(p))
}

func (s *Server) handlePutPreferences(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in prefsView
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	in = sanitizePrefs(in)

	err := s.store.UpsertUserPreference(r.Context(), sqlcgen.UpsertUserPreferenceParams{
		UserID:           u.ID,
		Theme:            in.Theme,
		Design:           "clean", // legacy column; unused by the new UI
		CardStyle:        in.CardStyle,
		Density:          in.Density,
		FontScale:        in.FontScale,
		AccentColor:      in.Accent,
		ShowImages:       boolToInt(in.ShowImages),
		ShowSource:       boolToInt(in.ShowSource),
		ShowDate:         boolToInt(in.ShowDate),
		ShowDescription:  boolToInt(in.ShowDescription),
		DescriptionLines: 2, // legacy column
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save"})
		return
	}
	writeJSON(w, http.StatusOK, in)
}

// sanitizePrefs clamps enum-like fields to allowed values to keep the DB clean.
func sanitizePrefs(p prefsView) prefsView {
	p.Theme = oneOf(p.Theme, []string{"system", "light", "dark", "sepia", "midnight"}, "system")
	p.CardStyle = oneOf(p.CardStyle, []string{"magazine", "compact", "headline"}, "magazine")
	p.Density = oneOf(p.Density, []string{"comfortable", "compact", "dense"}, "comfortable")
	p.FontScale = oneOf(p.FontScale, []string{"small", "medium", "large"}, "medium")
	if len(p.Accent) == 0 || len(p.Accent) > 32 {
		p.Accent = "#2563eb"
	}
	return p
}

func oneOf(v string, allowed []string, fallback string) string {
	for _, a := range allowed {
		if v == a {
			return v
		}
	}
	return fallback
}
