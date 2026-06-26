package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/koaladev/koalanews/internal/api"
	"github.com/koaladev/koalanews/internal/config"
	"github.com/koaladev/koalanews/internal/db"
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

	go rss.RunWorker(ctx, store, cfg.SyncInterval)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           api.NewServer(store, web.FS(), cfg.DBPath()).Router(),
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
