package pathutil

import (
	"testing"
)

func TestGetRelativePathFromRemote(t *testing.T) {
	tests := []struct {
		name           string
		remoteBase     string
		fullRemotePath string
		expected       string
		expectErr      bool
	}{
		{
			name:           "simple relative path",
			remoteBase:     "/home/user/project",
			fullRemotePath: "/home/user/project/src/main.go",
			expected:       "src/main.go",
			expectErr:      false,
		},
		{
			name:           "root file",
			remoteBase:     "/home/user/project",
			fullRemotePath: "/home/user/project/file.txt",
			expected:       "file.txt",
			expectErr:      false,
		},
		{
			name:           "trailing slash in base",
			remoteBase:     "/home/user/project/",
			fullRemotePath: "/home/user/project/src/main.go",
			expected:       "src/main.go",
			expectErr:      false,
		},
		{
			name:           "path not under base",
			remoteBase:     "/home/user/project",
			fullRemotePath: "/home/other/file.txt",
			expected:       "",
			expectErr:      true,
		},
		{
			name:           "same path",
			remoteBase:     "/home/user/project",
			fullRemotePath: "/home/user/project",
			expected:       "",
			expectErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := GetRelativePathFromRemote(tt.remoteBase, tt.fullRemotePath)
			if tt.expectErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if result != tt.expected {
				t.Errorf("GetRelativePathFromRemote(%q, %q) = %q, want %q",
					tt.remoteBase, tt.fullRemotePath, result, tt.expected)
			}
		})
	}
}

func TestToRemotePath(t *testing.T) {
	tests := []struct {
		name       string
		remoteBase string
		relPath    string
		expected   string
	}{
		{
			name:       "simple path",
			remoteBase: "/home/user/project",
			relPath:    "src/main.go",
			expected:   "/home/user/project/src/main.go",
		},
		{
			name:       "root file",
			remoteBase: "/home/user/project",
			relPath:    "file.txt",
			expected:   "/home/user/project/file.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ToRemotePath(tt.remoteBase, tt.relPath)
			if result != tt.expected {
				t.Errorf("ToRemotePath(%q, %q) = %q, want %q",
					tt.remoteBase, tt.relPath, result, tt.expected)
			}
		})
	}
}

func TestIgnoreChecker_ShouldIgnore(t *testing.T) {
	checker := NewIgnoreChecker([]string{".git", "node_modules", "*.log", "tmp/"})

	tests := []struct {
		path     string
		expected bool
	}{
		{".git", true},
		{".git/config", true},
		{"node_modules", true},
		{"node_modules/express/index.js", true},
		{"app.log", true},
		{"logs/app.log", true},
		{"src/main.go", false},
		{"README.md", false},
		{"tmp/cache", true},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			result := checker.ShouldIgnore(tt.path)
			if result != tt.expected {
				t.Errorf("ShouldIgnore(%q) = %v, want %v", tt.path, result, tt.expected)
			}
		})
	}
}
