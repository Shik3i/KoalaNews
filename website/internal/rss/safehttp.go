package rss

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"syscall"
	"time"
)

// errBlocked is returned when a connection target resolves to a disallowed address.
var errBlocked = errors.New("blocked: unsafe host or IP")

// isPrivateIP reports whether addr is loopback, private, link-local, or otherwise
// not safe to fetch from a server-side request (SSRF protection).
func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	// 0.0.0.0/8 and other reserved ranges that IsPrivate misses.
	if v4 := ip.To4(); v4 != nil && v4[0] == 0 {
		return true
	}
	return false
}

func isBlockedHostname(host string) bool {
	h := strings.ToLower(strings.TrimSuffix(host, "."))
	return h == "localhost" || strings.HasSuffix(h, ".localhost")
}

// safeControl is a net.Dialer Control hook that runs AFTER DNS resolution, right
// before the socket connects. It inspects the concrete IP being dialed, closing
// the TOCTOU gap between "resolve" and "connect" that a pre-flight lookup leaves open.
func safeControl(_, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return errBlocked
	}
	ip := net.ParseIP(host)
	if ip == nil || isPrivateIP(ip) {
		return errBlocked
	}
	return nil
}

// SafeClient is an http.Client that refuses to connect to private/loopback addresses.
var SafeClient = newSafeClient()

func newSafeClient() *http.Client {
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control:   safeControl,
	}
	transport := &http.Transport{
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          50,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
	return &http.Client{
		Transport: transport,
		Timeout:   15 * time.Second,
		// Disallow auto-redirect; callers handle redirects with re-validation.
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

// validateURL enforces scheme, length, and hostname rules before a request is built.
func validateURL(raw string) error {
	if len(raw) > 2048 {
		return fmt.Errorf("%w: url too long", errBlocked)
	}
	u, err := parseHTTPURL(raw)
	if err != nil {
		return err
	}
	if isBlockedHostname(u.Hostname()) {
		return fmt.Errorf("%w: blocked hostname", errBlocked)
	}
	return nil
}

// fetchWithLimit performs a GET with manual redirect handling (max maxRedirects),
// revalidating each hop, and reads at most maxBytes of the body.
func fetchWithLimit(ctx context.Context, rawURL, userAgent string, maxBytes int64, maxRedirects int) ([]byte, string, error) {
	current := rawURL
	for hop := 0; ; hop++ {
		if err := validateURL(current); err != nil {
			return nil, "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, current, nil)
		if err != nil {
			return nil, "", err
		}
		req.Header.Set("User-Agent", userAgent)

		resp, err := SafeClient.Do(req)
		if err != nil {
			return nil, "", err
		}

		switch resp.StatusCode {
		case 301, 302, 303, 307, 308:
			loc := resp.Header.Get("Location")
			resp.Body.Close()
			if loc == "" || hop >= maxRedirects {
				return nil, "", errors.New("too many redirects")
			}
			next, err := resolveRedirect(current, loc)
			if err != nil {
				return nil, "", err
			}
			current = next
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			return nil, "", fmt.Errorf("unexpected status %d", resp.StatusCode)
		}

		body, err := readCapped(resp.Body, maxBytes)
		ct := resp.Header.Get("Content-Type")
		resp.Body.Close()
		if err != nil {
			return nil, "", err
		}
		return body, ct, nil
	}
}
