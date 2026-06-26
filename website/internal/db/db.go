package db

import (
	"context"
	"database/sql"
	_ "embed"
	"fmt"
	"strings"

	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaSQL string

// Store wraps the sql.DB and the sqlc-generated queries.
type Store struct {
	*sqlcgen.Queries
	DB *sql.DB
}

// Open opens the SQLite database, applies pragmas, and ensures the schema exists.
func Open(ctx context.Context, path string) (*Store, error) {
	dsn := fmt.Sprintf("%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)", path)
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	// modernc.org/sqlite is safe with a single writer; cap connections to avoid lock churn.
	sqlDB.SetMaxOpenConns(1)

	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	if _, err := sqlDB.ExecContext(ctx, schemaSQL); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	if err := migrate(ctx, sqlDB); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return &Store{Queries: sqlcgen.New(sqlDB), DB: sqlDB}, nil
}

// migrate applies additive column changes to databases created before those
// columns existed. CREATE TABLE IF NOT EXISTS never alters an existing table,
// so these idempotent ALTERs cover upgrades; "duplicate column name" is ignored.
func migrate(ctx context.Context, db *sql.DB) error {
	alters := []string{
		`ALTER TABLE feeds ADD COLUMN custom_title TEXT`,
		`ALTER TABLE user_preferences ADD COLUMN show_read_more INTEGER NOT NULL DEFAULT 1`,
	}
	for _, stmt := range alters {
		if _, err := db.ExecContext(ctx, stmt); err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			return fmt.Errorf("%q: %w", stmt, err)
		}
	}
	return nil
}

func (s *Store) Close() error { return s.DB.Close() }
