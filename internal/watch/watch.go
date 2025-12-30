// Package watch provides file system watching functionality
package watch

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/fatih/color"
	"github.com/fsnotify/fsnotify"
	"github.com/gong1414/island-bridge/internal/config"
	"github.com/gong1414/island-bridge/internal/pathutil"
	rsync "github.com/gong1414/island-bridge/internal/sync"
)

// Watcher watches for file changes and triggers sync
type Watcher struct {
	syncer        *rsync.Syncer
	project       *config.Project
	watcher       *fsnotify.Watcher
	debouncer     *debouncer
	ignoreChecker *pathutil.IgnoreChecker
	localBase     string
	verbose       bool
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

	// Use the same local base as syncer for consistency
	localBase := syncer.LocalBase()

	return &Watcher{
		syncer:        syncer,
		project:       project,
		watcher:       watcher,
		debouncer:     newDebouncer(300 * time.Millisecond),
		ignoreChecker: pathutil.NewIgnoreChecker(project.Ignore),
		localBase:     localBase,
		verbose:       false, // Can be made configurable
	}, nil
}

// SetVerbose enables verbose logging for debugging
func (w *Watcher) SetVerbose(verbose bool) {
	w.verbose = verbose
}

// Start starts watching for file changes
func (w *Watcher) Start() error {
	// Add all directories to the watcher
	err := filepath.Walk(w.localBase, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			relPath, _ := pathutil.GetRelativePath(w.localBase, path)
			if w.ignoreChecker.ShouldIgnore(relPath) {
				return filepath.SkipDir
			}
			return w.watcher.Add(path)
		}
		return nil
	})
	if err != nil {
		return err
	}

	color.Blue("Watching for changes in: %s", w.localBase)
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
	relPath, _ := pathutil.GetRelativePath(w.localBase, event.Name)
	if w.ignoreChecker.ShouldIgnore(relPath) {
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
			// Log error in verbose mode for debugging
			if w.verbose {
				color.Yellow("  ⚠ delete remote failed: %v", err)
			}
		}
	}
}

// Close closes the watcher
func (w *Watcher) Close() error {
	return w.watcher.Close()
}

