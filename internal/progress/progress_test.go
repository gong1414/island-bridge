package progress

import (
	"bytes"
	"io"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewProgressTracker(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")
	assert.NotNil(t, pt)
	assert.Equal(t, int64(100), pt.total)
	assert.Equal(t, int64(0), pt.completed)
	assert.Equal(t, int64(0), pt.errors)
	assert.Equal(t, int64(0), pt.skipped)
	assert.Equal(t, "Test", pt.message)
	assert.Equal(t, "items", pt.unit)
	assert.Equal(t, 40, pt.barWidth)
}

func TestIncrement(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")
	pt.Increment()
	assert.Equal(t, int64(1), pt.completed)
}

func TestUpdate(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")
	pt.Update(5)
	assert.Equal(t, int64(5), pt.completed)
}

func TestAddError(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")
	pt.AddError()
	assert.Equal(t, int64(1), pt.errors)
}

func TestAddSkipped(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")
	pt.AddSkipped()
	assert.Equal(t, int64(1), pt.skipped)
}

func TestProgress(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	pt := NewProgressTracker(10, "Testing", "files")
	for i := 0; i < 10; i++ {
		pt.Increment()
	}
	pt.Finish()

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	assert.Contains(t, output, "Total: 10 files")
	assert.Contains(t, output, "Skipped: 0")
	assert.Contains(t, output, "Errors: 0")
}

func TestProgressWithErrors(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	pt := NewProgressTracker(10, "Testing", "files")
	for i := 0; i < 8; i++ {
		pt.Increment()
	}
	pt.AddError()
	pt.AddError()
	pt.Finish()

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	assert.Contains(t, output, "Errors: 2")
	assert.Contains(t, output, "Total: 8 files")
}

func TestProgressWithSkipped(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	pt := NewProgressTracker(10, "Testing", "files")
	for i := 0; i < 7; i++ {
		pt.Increment()
	}
	pt.AddSkipped()
	pt.AddSkipped()
	pt.AddSkipped()
	pt.Finish()

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	assert.Contains(t, output, "Skipped: 3")
	assert.Contains(t, output, "Total: 7 files")
}

func TestProgressRate(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	pt := NewProgressTracker(10, "Testing", "files")
	pt.Update(10)
	pt.Finish()

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	assert.Contains(t, output, "Average rate")
}

func TestZeroProgress(t *testing.T) {
	oldStdout := os.Stdout
	r, w, _ := os.Pipe()
	os.Stdout = w

	pt := NewProgressTracker(10, "Testing", "files")
	pt.Finish()

	w.Close()
	os.Stdout = oldStdout

	var buf bytes.Buffer
	io.Copy(&buf, r)
	output := buf.String()

	assert.Contains(t, output, "Errors: 0")
	assert.Contains(t, output, "Skipped: 0")
}

func TestConcurrentUpdates(t *testing.T) {
	pt := NewProgressTracker(1000, "Test", "items")

	done := make(chan bool)
	for i := 0; i < 100; i++ {
		go func() {
			for j := 0; j < 10; j++ {
				pt.Increment()
			}
			done <- true
		}()
	}

	for i := 0; i < 100; i++ {
		<-done
	}

	assert.Equal(t, int64(1000), pt.completed)
}

func TestETACalculation(t *testing.T) {
	pt := NewProgressTracker(100, "Test", "items")

	pt.Update(10)
	time.Sleep(100 * time.Millisecond)
	pt.Update(10)

	assert.Equal(t, int64(20), pt.completed)
	assert.Equal(t, int64(100), pt.total)
}
