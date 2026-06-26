// Package web embeds the built SvelteKit static frontend (web/build) into the binary.
package web

import (
	"embed"
	"io/fs"
)

//go:embed all:build
var buildFS embed.FS

// FS returns the frontend file system rooted at the build directory.
func FS() fs.FS {
	sub, err := fs.Sub(buildFS, "build")
	if err != nil {
		panic("web: build dir missing: " + err.Error())
	}
	return sub
}
