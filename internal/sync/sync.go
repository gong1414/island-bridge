// Package sync provides file synchronization functionality
package sync

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/fatih/color"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/fileinfo"
	"github.com/gong1414/island-bridge/internal/pathutil"
	"github.com/gong1414/island-bridge/internal/progress"
	"github.com/gong1414/island-bridge/internal/retry"
	"github.com/gong1414/island-bridge/internal/ssh"
)

// Syncer handles file synchronization between local and remote
type Syncer struct {
	client        *ssh.Client
	project       *config.Project
	ignoreChecker *pathutil.IgnoreChecker
	localBase     string
	stats         SyncStats
	fileChecker   *fileinfo.FileCache
	cacheMutex    sync.RWMutex
	config        SyncConfig
}

// SyncStats tracks synchronization statistics
type SyncStats struct {
	Uploaded   int64
	Downloaded int64
	Deleted    int64
	Skipped    int64
	Errors     int64
}

// SyncConfig configures synchronization behavior
type SyncConfig struct {
	MaxConcurrency   int
	EnableRetry      bool
	RetryAttempts    int
	SkipInitialSync  bool
	ShowProgress     bool
	ConflictStrategy string
}

// DefaultSyncConfig returns sensible defaults
func DefaultSyncConfig() SyncConfig {
	return SyncConfig{
		MaxConcurrency:   10,
		EnableRetry:      true,
		RetryAttempts:    3,
		SkipInitialSync:  false,
		ShowProgress:     true,
		ConflictStrategy: "local-wins",
	}
}

// SyncDirection represents the direction of sync
type SyncDirection string

const (
	// DirectionUpload syncs from local to remote
	DirectionUpload SyncDirection = "upload"
	// DirectionDownload syncs from remote to local
	DirectionDownload SyncDirection = "download"
	// DirectionBoth syncs bidirectionally
	DirectionBoth SyncDirection = "both"
)

// NewSyncer creates a new Syncer
func NewSyncer(client *ssh.Client, project *config.Project) *Syncer {
	localBase, _ := pathutil.ResolveLocalBase(project)
	return &Syncer{
		client:        client,
		project:       project,
		ignoreChecker: pathutil.NewIgnoreChecker(project.Ignore),
		localBase:     localBase,
		fileChecker:   fileinfo.NewFileCache(),
		config:        DefaultSyncConfig(),
	}
}

// NewSyncerWithConfig creates a new Syncer with custom config
func NewSyncerWithConfig(client *ssh.Client, project *config.Project, cfg SyncConfig) *Syncer {
	localBase, _ := pathutil.ResolveLocalBase(project)
	return &Syncer{
		client:        client,
		project:       project,
		ignoreChecker: pathutil.NewIgnoreChecker(project.Ignore),
		localBase:     localBase,
		fileChecker:   fileinfo.NewFileCache(),
		config:        cfg,
	}
}

// LocalBase returns the resolved local base path
func (s *Syncer) LocalBase() string {
	return s.localBase
}

// SyncAll performs a full sync from local to remote
func (s *Syncer) SyncAll() error {
	color.Blue("Starting full sync: %s -> %s", s.project.LocalPath, s.project.RemotePath)

	// Collect files first for concurrent processing
	var filesToSync []string
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

		filesToSync = append(filesToSync, path)
		return nil
	})

	if err != nil {
		return err
	}

	// Process files concurrently
	return s.syncFilesConcurrently(filesToSync)
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

// SyncFromRemote performs a full sync from remote to local
func (s *Syncer) SyncFromRemote() error {
	color.Blue("Starting full sync: %s -> %s", s.project.RemotePath, s.project.LocalPath)

	return s.walkRemoteDir(s.project.RemotePath)
}

// walkRemoteDir recursively walks remote directory and downloads files
func (s *Syncer) walkRemoteDir(remotePath string) error {
	entries, err := s.client.ReadDir(remotePath)
	if err != nil {
		return fmt.Errorf("failed to read remote directory %s: %w", remotePath, err)
	}

	for _, entry := range entries {
		remoteFilePath := pathutil.ToRemotePath(remotePath, entry.Name())
		relPath, err := pathutil.GetRelativePathFromRemote(s.project.RemotePath, remoteFilePath)
		if err != nil {
			s.stats.Errors++
			continue
		}

		if s.ignoreChecker.ShouldIgnore(relPath) {
			if entry.IsDir() {
				s.stats.Skipped++
				continue
			}
			s.stats.Skipped++
			continue
		}

		if entry.IsDir() {
			if err := s.walkRemoteDir(remoteFilePath); err != nil {
				s.stats.Errors++
			}
			continue
		}

		localPath := filepath.Join(s.localBase, relPath)

		if err := s.client.DownloadFile(remoteFilePath, localPath); err != nil {
			color.Red("  ✗ %s: %v", relPath, err)
			s.stats.Errors++
			continue
		}

		color.Green("  ✓ %s", relPath)
		s.stats.Downloaded++
	}

	return nil
}

// SyncFileFromRemote syncs a single file from remote to local
func (s *Syncer) SyncFileFromRemote(remotePath string) error {
	relPath, err := pathutil.GetRelativePathFromRemote(s.project.RemotePath, remotePath)
	if err != nil {
		return err
	}

	if s.ignoreChecker.ShouldIgnore(relPath) {
		return nil
	}

	localPath := filepath.Join(s.localBase, relPath)

	if err := s.client.DownloadFile(remotePath, localPath); err != nil {
		return err
	}

	color.Green("  ✓ downloaded: %s", relPath)
	return nil
}

// Sync performs sync based on project mode
func (s *Syncer) Sync(direction SyncDirection) error {
	switch direction {
	case DirectionUpload:
		return s.SyncAll()
	case DirectionDownload:
		if err := s.SyncFromRemote(); err != nil {
			return err
		}
		s.printDownloadStats()
		return nil
	case DirectionBoth:
		// First download from remote, then upload local changes
		color.Blue("Starting bidirectional sync...")
		if err := s.SyncFromRemote(); err != nil {
			return err
		}
		return s.SyncAll()
	default:
		return s.SyncAll()
	}
}

// GetDirectionFromMode returns the sync direction based on project mode
func GetDirectionFromMode(mode string) SyncDirection {
	switch mode {
	case config.SyncModeOneWayLocal:
		return DirectionUpload
	case config.SyncModeOneWayRemote:
		return DirectionDownload
	case config.SyncModeTwoWay:
		return DirectionBoth
	default:
		return DirectionUpload
	}
}

func (s *Syncer) printStats() {
	fmt.Println()
	color.Blue("Sync completed:")
	fmt.Printf("  Uploaded: %d\n", s.stats.Uploaded)
	fmt.Printf("  Skipped:  %d\n", s.stats.Skipped)
	fmt.Printf("  Errors:   %d\n", s.stats.Errors)
}

func (s *Syncer) printDownloadStats() {
	fmt.Println()
	color.Blue("Sync completed:")
	fmt.Printf("  Downloaded: %d\n", s.stats.Downloaded)
	fmt.Printf("  Skipped:    %d\n", s.stats.Skipped)
	fmt.Printf("  Errors:     %d\n", s.stats.Errors)
}

// syncFilesConcurrently processes files concurrently with worker pool
func (s *Syncer) syncFilesConcurrently(files []string) error {
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, s.config.MaxConcurrency)
	errors := make(chan error, len(files))

	var tracker *progress.ProgressTracker
	if s.config.ShowProgress {
		tracker = progress.NewProgressTracker(int64(len(files)), "Syncing files", "files")
		defer tracker.Finish()
	}

	for _, filePath := range files {
		wg.Add(1)
		go func(path string) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()

			if err := s.syncFileIfChanged(path); err != nil {
				errors <- err
				if tracker != nil {
					tracker.AddError()
				}
			} else if tracker != nil {
				tracker.Increment()
			}
		}(filePath)
	}

	wg.Wait()
	close(errors)

	// Collect errors
	for err := range errors {
		color.Red("Sync error: %v", err)
		s.stats.Errors++
	}

	s.printStats()
	return nil
}

// needsSync checks if file needs to be synchronized
func (s *Syncer) needsSync(filePath string) (bool, error) {
	return s.fileChecker.HasChanged(filePath)
}

// syncFileIfChanged syncs file only if it has changed
func (s *Syncer) syncFileIfChanged(filePath string) error {
	needsSync, err := s.needsSync(filePath)
	if err != nil {
		return err
	}

	if !needsSync {
		s.stats.Skipped++
		return nil
	}

	relPath, err := pathutil.GetRelativePath(s.localBase, filePath)
	if err != nil {
		return err
	}

	remotePath := pathutil.ToRemotePath(s.project.RemotePath, relPath)

	if s.config.EnableRetry {
		retryCfg := retry.DefaultRetryConfig()
		retryCfg.MaxAttempts = s.config.RetryAttempts
		return retry.Do(retryCfg, func() error {
			return s.client.UploadFile(filePath, remotePath)
		}, fmt.Sprintf("upload %s", relPath))
	}

	if err := s.client.UploadFile(filePath, remotePath); err != nil {
		return fmt.Errorf("failed to upload %s: %w", relPath, err)
	}

	color.Green("  ✓ %s", relPath)
	s.stats.Uploaded++
	return nil
}
