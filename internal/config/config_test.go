package config

import (
	"testing"
)

func TestProject_GetMode(t *testing.T) {
	tests := []struct {
		name     string
		project  Project
		expected string
	}{
		{
			name:     "empty mode returns default",
			project:  Project{Mode: ""},
			expected: SyncModeOneWayLocal,
		},
		{
			name:     "one-way-local",
			project:  Project{Mode: SyncModeOneWayLocal},
			expected: SyncModeOneWayLocal,
		},
		{
			name:     "one-way-remote",
			project:  Project{Mode: SyncModeOneWayRemote},
			expected: SyncModeOneWayRemote,
		},
		{
			name:     "two-way",
			project:  Project{Mode: SyncModeTwoWay},
			expected: SyncModeTwoWay,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.project.GetMode()
			if result != tt.expected {
				t.Errorf("GetMode() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestSyncModeConstants(t *testing.T) {
	if SyncModeOneWayLocal != "one-way-local" {
		t.Errorf("SyncModeOneWayLocal = %q, want %q", SyncModeOneWayLocal, "one-way-local")
	}
	if SyncModeOneWayRemote != "one-way-remote" {
		t.Errorf("SyncModeOneWayRemote = %q, want %q", SyncModeOneWayRemote, "one-way-remote")
	}
	if SyncModeTwoWay != "two-way" {
		t.Errorf("SyncModeTwoWay = %q, want %q", SyncModeTwoWay, "two-way")
	}
}

