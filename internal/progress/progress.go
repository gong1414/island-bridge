// Package progress provides progress tracking for operations
package progress

import (
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"github.com/fatih/color"
)

// ProgressTracker tracks operation progress
type ProgressTracker struct {
	total     int64
	completed int64
	errors    int64
	skipped   int64
	startTime time.Time
	message   string
	unit      string
	barWidth  int
}

// NewProgressTracker creates a new progress tracker
func NewProgressTracker(total int64, message, unit string) *ProgressTracker {
	return &ProgressTracker{
		total:     total,
		message:   message,
		unit:      unit,
		barWidth:  40,
		startTime: time.Now(),
	}
}

// Update increments the completed count
func (p *ProgressTracker) Update(delta int64) {
	atomic.AddInt64(&p.completed, delta)
	p.render()
}

// Increment increments completed by 1
func (p *ProgressTracker) Increment() {
	p.Update(1)
}

// AddError increments error count
func (p *ProgressTracker) AddError() {
	atomic.AddInt64(&p.errors, 1)
	p.render()
}

// AddSkipped increments skipped count
func (p *ProgressTracker) AddSkipped() {
	atomic.AddInt64(&p.skipped, 1)
	p.render()
}

// render displays the progress bar
func (p *ProgressTracker) render() {
	completed := atomic.LoadInt64(&p.completed)
	errors := atomic.LoadInt64(&p.errors)
	skipped := atomic.LoadInt64(&p.skipped)

	// Calculate percentage
	percentage := float64(completed) / float64(p.total) * 100

	// Build progress bar
	filled := int(float64(p.barWidth) * percentage / 100)
	bar := strings.Repeat("=", filled)
	bar += strings.Repeat(" ", p.barWidth-filled)

	// Calculate elapsed time and ETA
	elapsed := time.Since(p.startTime)
	var eta time.Duration
	if completed > 0 {
		avgTime := elapsed / time.Duration(completed)
		remaining := p.total - completed
		eta = avgTime * time.Duration(remaining)
	}

	// Render progress
	fmt.Printf("\r%s: [%s] %.1f%% (%d/%d %s) [%d skipped, %d errors] ETA: %v",
		p.message, bar, percentage, completed, p.total, p.unit, skipped, errors, eta.Round(time.Second))
}

// Finish marks the progress as complete
func (p *ProgressTracker) Finish() {
	completed := atomic.LoadInt64(&p.completed)
	errors := atomic.LoadInt64(&p.errors)
	skipped := atomic.LoadInt64(&p.skipped)
	elapsed := time.Since(p.startTime)

	fmt.Println() // New line after progress bar
	color.Blue("✓ %s completed in %v", p.message, elapsed.Round(time.Millisecond))
	fmt.Printf("  Total: %d %s\n", completed, p.unit)
	fmt.Printf("  Skipped: %d\n", skipped)
	fmt.Printf("  Errors: %d\n", errors)
	if completed > 0 {
		avgRate := float64(completed) / elapsed.Seconds()
		fmt.Printf("  Average rate: %.1f %s/sec\n", avgRate, p.unit)
	}
}
