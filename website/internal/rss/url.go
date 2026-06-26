package rss

import (
	"fmt"
	"io"
	"net/url"
)

func parseHTTPURL(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid url", errBlocked)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("%w: unsupported scheme %q", errBlocked, u.Scheme)
	}
	if u.Hostname() == "" {
		return nil, fmt.Errorf("%w: missing host", errBlocked)
	}
	return u, nil
}

// resolveRedirect resolves a (possibly relative) Location against the current URL.
func resolveRedirect(current, location string) (string, error) {
	base, err := url.Parse(current)
	if err != nil {
		return "", err
	}
	loc, err := url.Parse(location)
	if err != nil {
		return "", fmt.Errorf("%w: bad redirect location", errBlocked)
	}
	return base.ResolveReference(loc).String(), nil
}

// readCapped reads up to maxBytes+1 and errors if the limit is exceeded.
func readCapped(r io.Reader, maxBytes int64) ([]byte, error) {
	limited := io.LimitReader(r, maxBytes+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, fmt.Errorf("response exceeds %d bytes", maxBytes)
	}
	return data, nil
}

// NormalizeFeedURL validates and canonicalizes a feed URL for storage.
func NormalizeFeedURL(raw string) (string, error) {
	if err := validateURL(raw); err != nil {
		return "", err
	}
	u, err := parseHTTPURL(raw)
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
