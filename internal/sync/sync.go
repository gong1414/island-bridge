// Package sync provides file synchronization functionality
package sync

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/fatih/color"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/pathutil"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// Syncer handles file synchronization between local and remote
type Syncer struct {
	client        *ssh.Client
	project       *config.Project
	ignoreChecker *pathutil.IgnoreChecker
	localBase     string
	stats         SyncStats
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
	localBase, _ := pathutil.ResolveLocalBase(project)
	return &Syncer{
		client:        client,
		project:       project,
		ignoreChecker: pathutil.NewIgnoreChecker(project.Ignore),
		localBase:     localBase,
	}
}

// LocalBase returns the resolved local base path
func (s *Syncer) LocalBase() string {
	return s.localBase
}

// SyncAll performs a full sync from local to remote
func (s *Syncer) SyncAll() error {
	color.Blue("Starting full sync: %s -> %s", s.project.LocalPath, s.project.RemotePath)

	err := filepath.Walk(s.localBase, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := pathutil.GetRelativePath(s.localBase, path)
		if err != nil {
			return err
		}

		if s.ignoreChecker.ShouldIgnore(relPath) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			s.stats.Skipped++
			return nil
		}

		if info.IsDir() {
			return nil
		}

		remotePath := pathutil.ToRemotePath(s.project.RemotePath, relPath)

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
	relPath, err := pathutil.GetRelativePath(s.localBase, localPath)
	if err != nil {
		return err
	}

	if s.ignoreChecker.ShouldIgnore(relPath) {
		return nil
	}

	remotePath := pathutil.ToRemotePath(s.project.RemotePath, relPath)

	if err := s.client.UploadFile(localPath, remotePath); err != nil {
		return err
	}

	color.Green("  ✓ synced: %s", relPath)
	return nil
}

// DeleteRemote deletes a file from remote
func (s *Syncer) DeleteRemote(localPath string) error {
	relPath, err := pathutil.GetRelativePath(s.localBase, localPath)
	if err != nil {
		return err
	}

	remotePath := pathutil.ToRemotePath(s.project.RemotePath, relPath)

	if err := s.client.Remove(remotePath); err != nil {
		return err
	}

	color.Yellow("  ✗ deleted: %s", relPath)
	return nil
}

func (s *Syncer) printStats() {
	fmt.Println()
	color.Blue("Sync completed:")
	fmt.Printf("  Uploaded: %d\n", s.stats.Uploaded)
	fmt.Printf("  Skipped:  %d\n", s.stats.Skipped)
	fmt.Printf("  Errors:   %d\n", s.stats.Errors)
}

