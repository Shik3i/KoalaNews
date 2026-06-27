package api

import (
	"encoding/json"
	"net/http"

	"github.com/koaladev/koalanews/internal/db/sqlcgen"
)

// prefsView is the appearance shape the SvelteKit frontend speaks (camelCase).
type prefsView struct {
	Theme            string `json:"theme"`
	Design           string `json:"design"`
	Accent           string `json:"accent"`
	CardStyle        string `json:"cardStyle"`
	Density          string `json:"density"`
	FontScale        string `json:"fontScale"`
	Background       string `json:"background"`
	FontFamily       string `json:"fontFamily"`
	DescriptionLines int    `json:"descriptionLines"`
	ShowImages       bool   `json:"showImages"`
	ShowSource       bool   `json:"showSource"`
	ShowDate         bool   `json:"showDate"`
	ShowDescription  bool   `json:"showDescription"`
	ShowReadMore     bool   `json:"showReadMore"`
}

func defaultPrefs() prefsView {
	return prefsView{
		Theme: "system", Design: "clean", Accent: "#2563eb", CardStyle: "magazine",
		Density: "comfortable", FontScale: "medium", Background: "flat", FontFamily: "system",
		DescriptionLines: 3,
		ShowImages:       true, ShowSource: true, ShowDate: true, ShowDescription: true, ShowReadMore: true,
	}
}

func toPrefsView(p sqlcgen.UserPreference) prefsView {
	return prefsView{
		Theme:            p.Theme,
		Design:           p.Design,
		Accent:           p.AccentColor,
		CardStyle:        p.CardStyle,
		Density:          p.Density,
		FontScale:        p.FontScale,
		Background:       p.Background,
		FontFamily:       p.FontFamily,
		DescriptionLines: int(p.DescriptionLines),
		ShowImages:       p.ShowImages != 0,
		ShowSource:       p.ShowSource != 0,
		ShowDate:         p.ShowDate != 0,
		ShowDescription:  p.ShowDescription != 0,
		ShowReadMore:     p.ShowReadMore != 0,
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
		Design:           in.Design,
		CardStyle:        in.CardStyle,
		Density:          in.Density,
		FontScale:        in.FontScale,
		Background:       in.Background,
		FontFamily:       in.FontFamily,
		AccentColor:      in.Accent,
		ShowImages:       boolToInt(in.ShowImages),
		ShowSource:       boolToInt(in.ShowSource),
		ShowDate:         boolToInt(in.ShowDate),
		ShowDescription:  boolToInt(in.ShowDescription),
		ShowReadMore:     boolToInt(in.ShowReadMore),
		DescriptionLines: int64(in.DescriptionLines),
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not save"})
		return
	}
	writeJSON(w, http.StatusOK, in)
}

// sanitizePrefs clamps enum-like fields to allowed values to keep the DB clean.
func sanitizePrefs(p prefsView) prefsView {
	p.Theme = oneOf(p.Theme, []string{"system", "light", "dark", "sepia", "midnight", "forest", "rose", "nord", "contrast"}, "system")
	p.Design = oneOf(p.Design, []string{"clean", "newspaper", "terminal", "soft", "glass", "retrowave", "high-contrast"}, "clean")
	p.CardStyle = oneOf(p.CardStyle, []string{"magazine", "compact", "headline"}, "magazine")
	p.Density = oneOf(p.Density, []string{"comfortable", "compact", "dense"}, "comfortable")
	p.FontScale = oneOf(p.FontScale, []string{"small", "medium", "large"}, "medium")
	p.Background = oneOf(p.Background, []string{"flat", "soft-glow", "gradient", "dotted"}, "flat")
	p.FontFamily = oneOf(p.FontFamily, []string{"system", "serif", "mono"}, "system")
	if p.DescriptionLines < 0 {
		p.DescriptionLines = 0
	} else if p.DescriptionLines > 5 {
		p.DescriptionLines = 5
	}
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
