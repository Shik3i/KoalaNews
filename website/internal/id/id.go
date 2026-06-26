// Package id generates collision-resistant, URL-safe identifiers.
package id

import (
	"crypto/rand"
	"encoding/base32"
)

var enc = base32.NewEncoding("0123456789abcdefghjkmnpqrstvwxyz").WithPadding(base32.NoPadding)

// New returns a 26-char lowercase base32 random ID (~125 bits of entropy).
func New() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("id: entropy source failed: " + err.Error())
	}
	return enc.EncodeToString(b)
}
