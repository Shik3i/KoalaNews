package api

import (
	"encoding/xml"
	"net/http"
	"strings"

	"github.com/koaladev/koalanews/internal/rss"
)

// --- Export ---

type opmlOutline struct {
	Text   string `xml:"text,attr"`
	Title  string `xml:"title,attr,omitempty"`
	Type   string `xml:"type,attr"`
	XMLURL string `xml:"xmlUrl,attr"`
}

type opmlDoc struct {
	XMLName xml.Name `xml:"opml"`
	Version string   `xml:"version,attr"`
	Head    struct {
		Title string `xml:"title"`
	} `xml:"head"`
	Body struct {
		Outlines []opmlOutline `xml:"outline"`
	} `xml:"body"`
}

func (s *Server) handleOPMLExport(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	feeds, err := s.store.ListFeedsByUser(r.Context(), u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}

	doc := opmlDoc{Version: "2.0"}
	doc.Head.Title = "KoalaNews subscriptions"
	for _, f := range feeds {
		title := f.Url
		if f.Title != nil && *f.Title != "" {
			title = *f.Title
		}
		doc.Body.Outlines = append(doc.Body.Outlines, opmlOutline{
			Text: title, Title: title, Type: "rss", XMLURL: f.Url,
		})
	}

	out, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "encode failed"})
		return
	}
	w.Header().Set("Content-Type", "text/x-opml; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="koalanews-feeds.opml"`)
	_, _ = w.Write([]byte(xml.Header))
	_, _ = w.Write(out)
}

// --- Import ---

type importOutline struct {
	XMLURL   string          `xml:"xmlUrl,attr"`
	Outlines []importOutline `xml:"outline"`
}

type importDoc struct {
	XMLName xml.Name `xml:"opml"`
	Body    struct {
		Outlines []importOutline `xml:"outline"`
	} `xml:"body"`
}

// collectURLs walks the (possibly nested) outline tree and gathers feed URLs.
func collectURLs(outlines []importOutline, into *[]string) {
	for _, o := range outlines {
		if u := strings.TrimSpace(o.XMLURL); u != "" {
			*into = append(*into, u)
		}
		if len(o.Outlines) > 0 {
			collectURLs(o.Outlines, into)
		}
	}
}

const maxImportFeeds = 200

func (s *Server) handleOPMLImport(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)

	body := http.MaxBytesReader(w, r.Body, 1<<20) // 1 MiB
	var doc importDoc
	if err := xml.NewDecoder(body).Decode(&doc); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid OPML"})
		return
	}

	var urls []string
	collectURLs(doc.Body.Outlines, &urls)
	if len(urls) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no feeds found in OPML"})
		return
	}
	if len(urls) > maxImportFeeds {
		urls = urls[:maxImportFeeds]
	}

	added, skipped, failed := 0, 0, 0
	for _, url := range urls {
		_, err := rss.SubscribeFeed(r.Context(), s.store, u.ID, url, "en")
		switch {
		case err == nil:
			added++
		case err == rss.ErrAlreadySubscribed:
			skipped++
		default:
			failed++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"added": added, "skipped": skipped, "failed": failed, "total": len(urls),
	})
}
