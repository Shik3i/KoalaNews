package auth

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/koaladev/koalanews/internal/db"
	"github.com/koaladev/koalanews/internal/db/sqlcgen"
	"github.com/koaladev/koalanews/internal/id"
)

const (
	CookieName     = "kn_session"
	sessionTTL     = 30 * 24 * time.Hour
	sqliteTimeFmt  = "2006-01-02 15:04:05"
)

var ErrNoSession = errors.New("no session")

// CreateSession stores a new session and returns its opaque id.
func CreateSession(ctx context.Context, store *db.Store, userID string) (string, error) {
	sid := id.New()
	expires := time.Now().Add(sessionTTL).UTC().Format(sqliteTimeFmt)
	if err := store.CreateSession(ctx, sqlcgen.CreateSessionParams{
		ID:        sid,
		UserID:    userID,
		ExpiresAt: expires,
	}); err != nil {
		return "", err
	}
	return sid, nil
}

// UserForRequest resolves the authenticated user from the session cookie.
func UserForRequest(ctx context.Context, store *db.Store, r *http.Request) (sqlcgen.User, error) {
	c, err := r.Cookie(CookieName)
	if err != nil || c.Value == "" {
		return sqlcgen.User{}, ErrNoSession
	}
	sess, err := store.GetSession(ctx, c.Value)
	if err != nil {
		return sqlcgen.User{}, ErrNoSession
	}
	user, err := store.GetUserByID(ctx, sess.UserID)
	if err != nil {
		return sqlcgen.User{}, ErrNoSession
	}
	if user.Banned != 0 {
		return sqlcgen.User{}, ErrNoSession
	}
	return user, nil
}

// SetSessionCookie writes the session cookie on the response.
func SetSessionCookie(w http.ResponseWriter, r *http.Request, sid string) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    sid,
		Path:     "/",
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(sessionTTL),
		MaxAge:   int(sessionTTL.Seconds()),
	})
}

// ClearSessionCookie expires the session cookie.
func ClearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https"
}
