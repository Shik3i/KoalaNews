package main

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/koaladev/koalanews/internal/api"
	"github.com/koaladev/koalanews/internal/auth"
	"github.com/koaladev/koalanews/internal/config"
	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
	"github.com/koaladev/koalanews/internal/rss"
	"github.com/koaladev/koalanews/web"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := db.Open(ctx, cfg.DBPath())
	if err != nil {
		return err
	}
	defer store.Close()

	if err := rss.EnsureDefaultFeeds(ctx, store); err != nil {
		slog.Warn("seed default feeds", "err", err)
	}
	if err := ensureConfiguredAdmin(ctx, store, cfg); err != nil {
		return err
	}

	go rss.RunWorker(ctx, store, cfg.SyncInterval)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewServer(store, web.FS(), cfg.DBPath(), cfg.AllowRegistration).Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "err", err)
			stop()
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func ensureConfiguredAdmin(ctx context.Context, store *db.Store, cfg config.Config) error {
	email := strings.ToLower(strings.TrimSpace(cfg.AdminEmail))
	password := cfg.AdminPassword
	if email == "" && password == "" {
		return nil
	}
	if email == "" || password == "" {
		return errors.New("ADMIN_EMAIL and ADMIN_PASSWORD must be set together")
	}
	if len(password) < 8 {
		return errors.New("ADMIN_PASSWORD must be at least 8 characters")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	user, err := store.GetUserByEmail(ctx, email)
	if err == nil {
		if _, err := store.DB.ExecContext(ctx, `
			UPDATE users
			SET password = ?, role = 'ADMIN', banned = 0, banned_reason = NULL
			WHERE id = ?
		`, hash, user.ID); err != nil {
			return err
		}
		_ = store.CreateUserPreference(ctx, user.ID)
		slog.Info("configured admin user updated", "email", email)
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	created, err := store.CreateUser(ctx, sqlcgen.CreateUserParams{
		ID:       id.New(),
		Email:    email,
		Password: &hash,
		Role:     "ADMIN",
	})
	if err != nil {
		return err
	}
	_ = store.CreateUserPreference(ctx, created.ID)
	slog.Info("configured admin user created", "email", email)
	return nil
}
