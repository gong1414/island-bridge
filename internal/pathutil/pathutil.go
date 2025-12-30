// Package pathutil provides common path utilities for sync and watch
package pathutil

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/gong1414/island-bridge/internal/config"
)

// ResolveLocalBase resolves the local base path from a project configuration.
// If the path is "./" or ".", it returns the current working directory.
func ResolveLocalBase(project *config.Project) (string, error) {
	localPath := project.LocalPath
	if localPath == "./" || localPath == "." || localPath == "" {
		return os.Getwd()
	}

	// Convert to absolute path if relative
	if !filepath.IsAbs(localPath) {
		cwd, err := os.Getwd()
		if err != nil {
			return "", err
		}
		localPath = filepath.Join(cwd, localPath)
	}

	return filepath.Clean(localPath), nil
}

// IgnoreChecker provides methods to check if paths should be ignored
type IgnoreChecker struct {
	patterns []string
}

// NewIgnoreChecker creates a new IgnoreChecker with the given patterns
func NewIgnoreChecker(patterns []string) *IgnoreChecker {
	return &IgnoreChecker{patterns: patterns}
}

// ShouldIgnore checks if the given relative path should be ignored
// based on the configured ignore patterns.
func (c *IgnoreChecker) ShouldIgnore(relPath string) bool {
	if relPath == "" || relPath == "." {
		return false
	}

	for _, pat := range c.patterns {
		// Match against base name
		if matched, _ := filepath.Match(pat, filepath.Base(relPath)); matched {
			return true
		}
		// Match against full path
		if matched, _ := filepath.Match(pat, relPath); matched {
			return true
		}
		// Check if pattern is contained in path (for directory patterns)
		if strings.Contains(relPath, pat) {
			return true
		}
		// Check path segments for directory matching
		segments := strings.Split(relPath, string(filepath.Separator))
		for _, seg := range segments {
			if matched, _ := filepath.Match(pat, seg); matched {
				return true
			}
		}
	}
	return false
}

// GetRelativePath returns the relative path from basePath to fullPath
func GetRelativePath(basePath, fullPath string) (string, error) {
	return filepath.Rel(basePath, fullPath)
}

// ToRemotePath converts a local relative path to a remote path
// by joining with the remote base and converting separators
func ToRemotePath(remoteBase, relPath string) string {
	remotePath := filepath.Join(remoteBase, relPath)
	// Convert to forward slashes for remote (Unix-style)
	return strings.ReplaceAll(remotePath, "\\", "/")
}
