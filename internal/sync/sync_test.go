package sync

import (
	"path/filepath"
	"testing"

	"github.com/gong1414/island-bridge/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestGetDirectionFromMode(t *testing.T) {
	tests := []struct {
		name     string
		mode     string
		expected SyncDirection
	}{
		{
			name:     "one-way-local returns upload",
			mode:     config.SyncModeOneWayLocal,
			expected: DirectionUpload,
		},
		{
			name:     "one-way-remote returns download",
			mode:     config.SyncModeOneWayRemote,
			expected: DirectionDownload,
		},
		{
			name:     "two-way returns both",
			mode:     config.SyncModeTwoWay,
			expected: DirectionBoth,
		},
		{
			name:     "empty mode returns upload (default)",
			mode:     "",
			expected: DirectionUpload,
		},
		{
			name:     "unknown mode returns upload (default)",
			mode:     "unknown",
			expected: DirectionUpload,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetDirectionFromMode(tt.mode)
			if result != tt.expected {
				t.Errorf("GetDirectionFromMode(%q) = %q, want %q", tt.mode, result, tt.expected)
			}
		})
	}
}

func TestSyncDirectionConstants(t *testing.T) {
	if DirectionUpload != "upload" {
		t.Errorf("DirectionUpload = %q, want %q", DirectionUpload, "upload")
	}
	if DirectionDownload != "download" {
		t.Errorf("DirectionDownload = %q, want %q", DirectionDownload, "download")
	}
	if DirectionBoth != "both" {
		t.Errorf("DirectionBoth = %q, want %q", DirectionBoth, "both")
	}
}

func TestDefaultSyncConfig(t *testing.T) {
	cfg := DefaultSyncConfig()
	assert.Equal(t, 10, cfg.MaxConcurrency)
	assert.True(t, cfg.EnableRetry)
	assert.Equal(t, 3, cfg.RetryAttempts)
	assert.False(t, cfg.SkipInitialSync)
	assert.True(t, cfg.ShowProgress)
	assert.Equal(t, "local-wins", cfg.ConflictStrategy)
}

func TestNewSyncer(t *testing.T) {
	project := &config.Project{
		Name:       "test-project",
		LocalPath:  ".",
		RemotePath: "/remote/path",
		Ignore:     []string{".git", "*.log"},
	}

	syncer := NewSyncer(nil, project)
	assert.NotNil(t, syncer)
	assert.NotNil(t, syncer.fileChecker)
	assert.NotNil(t, syncer.ignoreChecker)
}

func TestNewSyncerWithConfig(t *testing.T) {
	project := &config.Project{
		Name:       "test-project",
		LocalPath:  ".",
		RemotePath: "/remote/path",
	}

	cfg := SyncConfig{
		MaxConcurrency:   5,
		EnableRetry:      true,
		RetryAttempts:    5,
		ShowProgress:     false,
		ConflictStrategy: "remote-wins",
	}

	syncer := NewSyncerWithConfig(nil, project, cfg)
	assert.NotNil(t, syncer)
	assert.Equal(t, 5, syncer.config.MaxConcurrency)
	assert.Equal(t, 5, syncer.config.RetryAttempts)
	assert.False(t, syncer.config.ShowProgress)
	assert.Equal(t, "remote-wins", syncer.config.ConflictStrategy)
}

func TestLocalBase(t *testing.T) {
	tmpDir := t.TempDir()
	project := &config.Project{
		Name:       "test",
		LocalPath:  tmpDir,
		RemotePath: "/remote",
	}

	syncer := NewSyncer(nil, project)
	result := syncer.LocalBase()
	assert.Contains(t, result, filepath.Base(tmpDir))
}

func TestSyncStats(t *testing.T) {
	stats := SyncStats{}
	assert.Equal(t, int64(0), stats.Uploaded)
	assert.Equal(t, int64(0), stats.Downloaded)

	stats.Uploaded = 10
	stats.Downloaded = 5
	stats.Errors = 1
	assert.Equal(t, int64(10), stats.Uploaded)
	assert.Equal(t, int64(5), stats.Downloaded)
	assert.Equal(t, int64(1), stats.Errors)
}
