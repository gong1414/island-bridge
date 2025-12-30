// Package sync provides file synchronization functionality
package sync

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/fatih/color"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// Syncer handles file synchronization between local and remote
type Syncer struct {
	client     *ssh.Client
	project    *config.Project
	ignorePats []string
	stats      SyncStats
}

// SyncStats tracks synchronization statistics
type SyncStats struct {
	Uploaded int
	Deleted  int
	Skipped  int
	Errors   int
}

// NewSyncer creates a new Syncer
func NewSyncer(client *ssh.Client, project *config.Project) *Syncer {
	return &Syncer{
		client:     client,
		project:    project,
		ignorePats: project.Ignore,
	}
}

// SyncAll performs a full sync from local to remote
func (s *Syncer) SyncAll() error {
	color.Blue("Starting full sync: %s -> %s", s.project.LocalPath, s.project.RemotePath)

	localPath := s.project.LocalPath
	if localPath == "./" || localPath == "." {
		var err error
		localPath, err = os.Getwd()
		if err != nil {
			return err
		}
	}

	err := filepath.Walk(localPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(localPath, path)
		if err != nil {
			return err
		}

		if s.shouldIgnore(relPath) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			s.stats.Skipped++
			return nil
		}

		if info.IsDir() {
			return nil
		}

		remotePath := filepath.Join(s.project.RemotePath, relPath)
		// Convert to forward slashes for remote path
		remotePath = strings.ReplaceAll(remotePath, "\\", "/")

		if err := s.client.UploadFile(path, remotePath); err != nil {
			color.Red("  ✗ %s: %v", relPath, err)
			s.stats.Errors++
			return nil
		}

		color.Green("  ✓ %s", relPath)
		s.stats.Uploaded++
		return nil
	})

	s.printStats()
	return err
}

// SyncFile syncs a single file
func (s *Syncer) SyncFile(localPath string) error {
	localBase := s.project.LocalPath
	if localBase == "./" || localBase == "." {
		var err error
		localBase, err = os.Getwd()
		if err != nil {
			return err
		}
	}

	relPath, err := filepath.Rel(localBase, localPath)
	if err != nil {
		return err
	}

	if s.shouldIgnore(relPath) {
		return nil
	}

	remotePath := filepath.Join(s.project.RemotePath, relPath)
	remotePath = strings.ReplaceAll(remotePath, "\\", "/")

	if err := s.client.UploadFile(localPath, remotePath); err != nil {
		return err
	}

	color.Green("  ✓ synced: %s", relPath)
	return nil
}

// DeleteRemote deletes a file from remote
func (s *Syncer) DeleteRemote(localPath string) error {
	localBase := s.project.LocalPath
	if localBase == "./" || localBase == "." {
		var err error
		localBase, err = os.Getwd()
		if err != nil {
			return err
		}
	}

	relPath, err := filepath.Rel(localBase, localPath)
	if err != nil {
		return err
	}

	remotePath := filepath.Join(s.project.RemotePath, relPath)
	remotePath = strings.ReplaceAll(remotePath, "\\", "/")

	if err := s.client.Remove(remotePath); err != nil {
		return err
	}

	color.Yellow("  ✗ deleted: %s", relPath)
	return nil
}

func (s *Syncer) shouldIgnore(path string) bool {
	for _, pat := range s.ignorePats {
		// Simple pattern matching
		if matched, _ := filepath.Match(pat, filepath.Base(path)); matched {
			return true
		}
		if strings.Contains(path, pat) {
			return true
		}
	}
	return false
}

func (s *Syncer) printStats() {
	fmt.Println()
	color.Blue("Sync completed:")
	fmt.Printf("  Uploaded: %d\n", s.stats.Uploaded)
	fmt.Printf("  Skipped:  %d\n", s.stats.Skipped)
	fmt.Printf("  Errors:   %d\n", s.stats.Errors)
}

