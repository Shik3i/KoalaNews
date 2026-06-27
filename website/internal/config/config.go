package config

import (
	"os"
	"time"
)

type Config struct {
	Addr         string
	DatabaseURL  string // file path to the sqlite database
	SyncInterval time.Duration
	SessionKey   string // secret for signing session cookies
}

func Load() Config {
	return Config{
		Addr:         env("ADDR", ":3000"),
		DatabaseURL:  env("DATABASE_URL", "file:./koalanews-v2.db"),
		SyncInterval: envDuration("SYNC_INTERVAL", 15*time.Minute),
		SessionKey:   env("SESSION_KEY", "dev-insecure-session-key-change-me"),
	}
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

// DBPath strips an optional "file:" prefix to get the raw filesystem path.
func (c Config) DBPath() string {
	p := c.DatabaseURL
	if len(p) > 5 && p[:5] == "file:" {
		return p[5:]
	}
	return p
}
