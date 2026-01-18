// Package fileinfo provides fast file information checking
package fileinfo

import (
	"log"
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
	Added   time.Time
}

// FileCache provides fast file change detection
type FileCache struct {
	cache      map[string]FileCacheEntry
	mutex      sync.RWMutex
	maxAge     time.Duration
	totalCheck int64
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
	fc.mutex.Lock()
	fc.totalCheck++
	fc.mutex.Unlock()

	info, err := os.Stat(filePath)
	if err != nil {
		log.Printf("Warning: failed to stat file %s: %v", filePath, err)
		return true, nil
	}

	absPath, err := filepath.Abs(filePath)
	if err != nil {
		log.Printf("Warning: failed to get absolute path for %s: %v", filePath, err)
		return true, nil
	}

	fc.mutex.RLock()
	cached, exists := fc.cache[absPath]
	fc.mutex.RUnlock()

	if !exists {
		fc.cacheEntry(absPath, info)
		return true, nil
	}

	if time.Since(cached.Added) > fc.maxAge {
		fc.cacheEntry(absPath, info)
		return true, nil
	}

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
		Added:   time.Now(),
	}
}

// Clear removes all entries from cache
func (fc *FileCache) Clear() {
	fc.mutex.Lock()
	defer fc.mutex.Unlock()
	fc.cache = make(map[string]FileCacheEntry)
}

// Stats returns cache statistics
func (fc *FileCache) Stats() (int, int64) {
	fc.mutex.RLock()
	defer fc.mutex.RUnlock()
	return len(fc.cache), fc.totalCheck
}
