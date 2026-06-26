// Package backup implements GFS (grandfather-father-son) SQLite snapshots:
// one daily/weekly/monthly file each, pruned to 7/5/12 generations.
package backup

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

type Kind string

const (
	Daily   Kind = "daily"
	Weekly  Kind = "weekly"
	Monthly Kind = "monthly"
)

var retention = map[Kind]int{Daily: 7, Weekly: 5, Monthly: 12}

// trashTables hold bulk, regenerable data (re-synced from RSS) that's excluded
// from backups to keep snapshot size small — only config/account data persists.
var trashTables = []string{"article_reads", "articles", "image_cache"}

var nameRe = regexp.MustCompile(`^koalanews-backup-(daily|weekly|monthly)-([0-9W-]+)\.db$`)

type Info struct {
	Name      string `json:"name"`
	Kind      Kind   `json:"kind"`
	SizeBytes int64  `json:"sizeBytes"`
	CreatedAt string `json:"createdAt"`
}

func dirFor(dbPath string) string {
	return filepath.Join(filepath.Dir(dbPath), "backup")
}

// List returns existing backups, newest first.
func List(dbPath string) ([]Info, error) {
	return listDir(dirFor(dbPath))
}

func listDir(dir string) ([]Info, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]Info, 0, len(entries))
	for _, e := range entries {
		m := nameRe.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		fi, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, Info{
			Name:      e.Name(),
			Kind:      Kind(m[1]),
			SizeBytes: fi.Size(),
			CreatedAt: fi.ModTime().UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt > out[j].CreatedAt })
	return out, nil
}

// Create takes a fresh daily/weekly/monthly snapshot (VACUUM INTO, scrubbed of
// bulk tables) and prunes stale generations beyond the retention window.
func Create(ctx context.Context, db *sql.DB, dbPath string) ([]Info, error) {
	if _, err := os.Stat(dbPath); err != nil {
		return nil, fmt.Errorf("database not found: %w", err)
	}
	dir := dirFor(dbPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	targets := map[Kind]string{
		Daily:   fmt.Sprintf("koalanews-backup-daily-%s.db", now.Format("2006-01-02")),
		Weekly:  fmt.Sprintf("koalanews-backup-weekly-%s.db", isoWeek(now)),
		Monthly: fmt.Sprintf("koalanews-backup-monthly-%s.db", now.Format("2006-01")),
	}
	for _, name := range targets {
		if err := snapshot(ctx, db, filepath.Join(dir, name)); err != nil {
			return nil, err
		}
	}
	if err := prune(dir); err != nil {
		return nil, err
	}
	return List(dbPath)
}

// GetPath resolves a backup name to its on-disk path, rejecting anything
// that doesn't match the expected filename shape (no path traversal).
func GetPath(dbPath, name string) (string, error) {
	if !nameRe.MatchString(name) {
		return "", fmt.Errorf("invalid backup name")
	}
	full := filepath.Join(dirFor(dbPath), name)
	if _, err := os.Stat(full); err != nil {
		return "", err
	}
	return full, nil
}

func snapshot(ctx context.Context, db *sql.DB, target string) error {
	tmp := target + ".tmp"
	os.Remove(tmp)
	if _, err := db.ExecContext(ctx, "VACUUM INTO "+quoteSQLString(tmp)); err != nil {
		os.Remove(tmp)
		return fmt.Errorf("vacuum into: %w", err)
	}

	snap, err := sql.Open("sqlite", tmp)
	if err != nil {
		os.Remove(tmp)
		return err
	}
	defer snap.Close()

	stmts := append([]string{"PRAGMA foreign_keys=OFF"},
		append(deleteStmts(), "VACUUM")...)
	for _, stmt := range stmts {
		if _, err := snap.ExecContext(ctx, stmt); err != nil {
			snap.Close()
			os.Remove(tmp)
			return fmt.Errorf("scrub snapshot: %w", err)
		}
	}
	snap.Close()

	return os.Rename(tmp, target)
}

func deleteStmts() []string {
	out := make([]string, len(trashTables))
	for i, t := range trashTables {
		out[i] = fmt.Sprintf(`DELETE FROM "%s"`, t)
	}
	return out
}

func prune(dir string) error {
	infos, err := listDir(dir)
	if err != nil {
		return err
	}
	byKind := map[Kind][]Info{}
	for _, i := range infos {
		byKind[i.Kind] = append(byKind[i.Kind], i)
	}
	for kind, limit := range retention {
		list := byKind[kind]
		if len(list) <= limit {
			continue
		}
		for _, stale := range list[limit:] {
			os.Remove(filepath.Join(dir, stale.Name))
		}
	}
	return nil
}

func quoteSQLString(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

func isoWeek(t time.Time) string {
	year, week := t.ISOWeek()
	return fmt.Sprintf("%d-W%s", year, pad2(week))
}

func pad2(n int) string {
	s := strconv.Itoa(n)
	if len(s) < 2 {
		return "0" + s
	}
	return s
}
