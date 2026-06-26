package rss

import (
	"net"
	"testing"
)

func TestIsPrivateIP(t *testing.T) {
	blocked := []string{
		"127.0.0.1", "10.0.0.1", "172.16.0.1", "172.31.255.255",
		"192.168.1.1", "169.254.0.1", "0.0.0.0", "::1", "fc00::1", "fe80::1",
	}
	for _, s := range blocked {
		if ip := net.ParseIP(s); !isPrivateIP(ip) {
			t.Errorf("expected %s to be blocked", s)
		}
	}
	allowed := []string{"8.8.8.8", "1.1.1.1", "151.101.0.81", "2606:4700:4700::1111"}
	for _, s := range allowed {
		if ip := net.ParseIP(s); isPrivateIP(ip) {
			t.Errorf("expected %s to be allowed", s)
		}
	}
}

func TestValidateURL(t *testing.T) {
	bad := []string{
		"http://localhost/feed",
		"http://foo.localhost/feed",
		"ftp://example.com/feed",
		"file:///etc/passwd",
		"http://",
		"not a url",
	}
	for _, u := range bad {
		if err := validateURL(u); err == nil {
			t.Errorf("expected %q to be rejected", u)
		}
	}
	good := []string{
		"https://feeds.bbci.co.uk/news/rss.xml",
		"http://example.com/rss",
	}
	for _, u := range good {
		if err := validateURL(u); err != nil {
			t.Errorf("expected %q to pass, got %v", u, err)
		}
	}
}

func TestSafeControlBlocksPrivate(t *testing.T) {
	if err := safeControl("tcp", "127.0.0.1:80", nil); err == nil {
		t.Error("safeControl should block loopback connect")
	}
	if err := safeControl("tcp", "8.8.8.8:443", nil); err != nil {
		t.Errorf("safeControl should allow public IP, got %v", err)
	}
}
