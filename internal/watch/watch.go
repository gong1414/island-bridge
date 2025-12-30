// Package watch provides file system watching functionality
package watch

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fatih/color"
	"github.com/fsnotify/fsnotify"
	"github.com/gong1414/island-bridge/internal/config"
	rsync "github.com/gong1414/island-bridge/internal/sync"
)

// Watcher watches for file changes and triggers sync
type Watcher struct {
	syncer     *rsync.Syncer
	project    *config.Project
	watcher    *fsnotify.Watcher
	debouncer  *debouncer
	ignorePats []string
}

type debouncer struct {
	mu       sync.Mutex
	timer    *time.Timer
	duration time.Duration
	events   map[string]fsnotify.Event
}

func newDebouncer(d time.Duration) *debouncer {
	return &debouncer{
		duration: d,
		events:   make(map[string]fsnotify.Event),
	}
}

func (d *debouncer) add(event fsnotify.Event, callback func(map[string]fsnotify.Event)) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.events[event.Name] = event

	if d.timer != nil {
		d.timer.Stop()
	}

	d.timer = time.AfterFunc(d.duration, func() {
		d.mu.Lock()
		events := d.events
		d.events = make(map[string]fsnotify.Event)
		d.mu.Unlock()
		callback(events)
	})
}

// NewWatcher creates a new file watcher
func NewWatcher(syncer *rsync.Syncer, project *config.Project) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("failed to create watcher: %w", err)
	}

	return &Watcher{
		syncer:     syncer,
		project:    project,
		watcher:    watcher,
		debouncer:  newDebouncer(300 * time.Millisecond),
		ignorePats: project.Ignore,
	}, nil
}

// Start starts watching for file changes
func (w *Watcher) Start() error {
	localPath := w.project.LocalPath
	if localPath == "./" || localPath == "." {
		var err error
		localPath, err = os.Getwd()
		if err != nil {
			return err
		}
	}

	// Add all directories to the watcher
	err := filepath.Walk(localPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			relPath, _ := filepath.Rel(localPath, path)
			if w.shouldIgnore(relPath) {
				return filepath.SkipDir
			}
			return w.watcher.Add(path)
		}
		return nil
	})
	if err != nil {
		return err
	}

	color.Blue("Watching for changes in: %s", localPath)
	color.Yellow("Press Ctrl+C to stop\n")

	// Process events
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return nil
			}
			w.handleEvent(event)

		case err, ok := <-w.watcher.Errors:
			if !ok {
				return nil
			}
			color.Red("Watcher error: %v", err)
		}
	}
}

func (w *Watcher) handleEvent(event fsnotify.Event) {
	relPath, _ := filepath.Rel(w.project.LocalPath, event.Name)
	if w.shouldIgnore(relPath) {
		return
	}

	w.debouncer.add(event, func(events map[string]fsnotify.Event) {
		for _, e := range events {
			w.processEvent(e)
		}
	})
}

func (w *Watcher) processEvent(event fsnotify.Event) {
	switch {
	case event.Op&fsnotify.Write == fsnotify.Write,
		event.Op&fsnotify.Create == fsnotify.Create:
		info, err := os.Stat(event.Name)
		if err == nil && !info.IsDir() {
			if err := w.syncer.SyncFile(event.Name); err != nil {
				color.Red("  ✗ sync failed: %v", err)
			}
		}

	case event.Op&fsnotify.Remove == fsnotify.Remove,
		event.Op&fsnotify.Rename == fsnotify.Rename:
		if err := w.syncer.DeleteRemote(event.Name); err != nil {
			// Ignore errors for delete operations
		}
	}
}

func (w *Watcher) shouldIgnore(path string) bool {
	for _, pat := range w.ignorePats {
		if matched, _ := filepath.Match(pat, filepath.Base(path)); matched {
			return true
		}
		if strings.Contains(path, pat) {
			return true
		}
	}
	return false
}

// Close closes the watcher
func (w *Watcher) Close() error {
	return w.watcher.Close()
}

