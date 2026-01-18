// Package fileinfo provides fast file information checking
package fileinfo

import (
	"os"
	"path/filepath"
	"sync"
	"time"
)

// FileCacheEntry stores file information for quick comparison
type FileCacheEntry struct {
	ModTime time.Time
	Size    int64
	Path    string
}

// FileCache provides fast file change detection
type FileCache struct {
	cache  map[string]FileCacheEntry
	mutex  sync.RWMutex
	maxAge time.Duration
}

// NewFileCache creates a new file cache
func NewFileCache() *FileCache {
	return &FileCache{
		cache:  make(map[string]FileCacheEntry),
		maxAge: 24 * time.Hour, // Cache entries valid for 24 hours
	}
}

// HasChanged checks if file has changed since last check
func (fc *FileCache) HasChanged(filePath string) (bool, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return true, nil // Treat errors as changed to trigger sync
	}

	// Get relative path for caching
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return true, nil
	}

	fc.mutex.RLock()
	cached, exists := fc.cache[absPath]
	fc.mutex.RUnlock()

	if !exists {
		fc.cacheEntry(absPath, info)
		return true, nil
	}

	// Fast check: compare modification time and size
	if info.ModTime() != cached.ModTime || info.Size() != cached.Size {
		fc.cacheEntry(absPath, info)
		return true, nil
	}

	return false, nil
}

// cacheEntry stores file info in cache
func (fc *FileCache) cacheEntry(path string, info os.FileInfo) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return
	}

	fc.mutex.Lock()
	defer fc.mutex.Unlock()

	fc.cache[absPath] = FileCacheEntry{
		ModTime: info.ModTime(),
		Size:    info.Size(),
		Path:    absPath,
	}
}

// Clear removes all entries from cache
func (fc *FileCache) Clear() {
	fc.mutex.Lock()
	defer fc.mutex.Unlock()
	fc.cache = make(map[string]FileCacheEntry)
}

// Stats returns cache statistics
func (fc *FileCache) Stats() (int, int) {
	fc.mutex.RLock()
	defer fc.mutex.RUnlock()
	return len(fc.cache), len(fc.cache)
}
