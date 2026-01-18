package sync

import (
	"testing"

	"github.com/gong1414/island-bridge/internal/config"
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
