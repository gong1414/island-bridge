package fileinfo

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewFileCache(t *testing.T) {
	fc := NewFileCache()
	assert.NotNil(t, fc)
	assert.NotNil(t, fc.cache)
	assert.Equal(t, 24*time.Hour, fc.maxAge)
	assert.Equal(t, int64(0), fc.totalCheck)
}

func TestHasChanged_NewFile(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	changed, err := fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)
}

func TestHasChanged_UnchangedFile(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	changed, err := fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)

	changed, err = fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.False(t, changed)
}

func TestHasChanged_ModifiedFile(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	changed, err := fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)

	time.Sleep(100 * time.Millisecond)
	err = os.WriteFile(testFile, []byte("modified content"), 0644)
	assert.NoError(t, err)

	changed, err = fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)
}

func TestHasChanged_ExpiredCache(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()
	fc.maxAge = 100 * time.Millisecond

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	changed, err := fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)

	time.Sleep(150 * time.Millisecond)

	changed, err = fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)
}

func TestHasChanged_NonexistentFile(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "nonexistent.txt")

	changed, err := fc.HasChanged(testFile)
	assert.NoError(t, err)
	assert.True(t, changed)
}

func TestClear(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	fc.HasChanged(testFile)

	cacheSize, _ := fc.Stats()
	assert.Greater(t, cacheSize, 0)

	fc.Clear()

	cacheSize, _ = fc.Stats()
	assert.Equal(t, 0, cacheSize)
}

func TestStats(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	cacheSize, totalChecks := fc.Stats()
	assert.Equal(t, 0, cacheSize)
	assert.Equal(t, int64(0), totalChecks)

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	fc.HasChanged(testFile)
	fc.HasChanged(testFile)
	fc.HasChanged(testFile)

	cacheSize, totalChecks = fc.Stats()
	assert.Equal(t, 1, cacheSize)
	assert.Equal(t, int64(3), totalChecks)
}

func TestConcurrentAccess(t *testing.T) {
	tmpDir := t.TempDir()
	fc := NewFileCache()

	testFile := filepath.Join(tmpDir, "test.txt")
	err := os.WriteFile(testFile, []byte("test content"), 0644)
	assert.NoError(t, err)

	done := make(chan bool)
	for i := 0; i < 100; i++ {
		go func() {
			for j := 0; j < 10; j++ {
				fc.HasChanged(testFile)
			}
			done <- true
		}()
	}

	for i := 0; i < 100; i++ {
		<-done
	}

	cacheSize, totalChecks := fc.Stats()
	assert.Equal(t, 1, cacheSize)
	assert.Equal(t, int64(1000), totalChecks)
}
