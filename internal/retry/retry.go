// Package retry provides retry logic for operations
package retry

import (
	"fmt"
	"time"
)

// RetryConfig configures retry behavior
type RetryConfig struct {
	MaxAttempts   int
	InitialDelay  time.Duration
	MaxDelay      time.Duration
	BackoffFactor float64
}

// DefaultRetryConfig returns sensible defaults
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  1 * time.Second,
		MaxDelay:      30 * time.Second,
		BackoffFactor: 2.0,
	}
}

// Do executes a function with retry logic
func Do(config RetryConfig, operation func() error, description string) error {
	var lastErr error
	delay := config.InitialDelay

	for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
		err := operation()
		if err == nil {
			return nil
		}

		lastErr = err
		if attempt < config.MaxAttempts {
			fmt.Printf("  ⚠ %s failed (attempt %d/%d): %v, retrying in %v...\n",
				description, attempt, config.MaxAttempts, err, delay)
			time.Sleep(delay)
			delay = time.Duration(float64(delay) * config.BackoffFactor)
			if delay > config.MaxDelay {
				delay = config.MaxDelay
			}
		}
	}

	return fmt.Errorf("%s failed after %d attempts: %w", description, config.MaxAttempts, lastErr)
}
