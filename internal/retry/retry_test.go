package retry

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDefaultRetryConfig(t *testing.T) {
	cfg := DefaultRetryConfig()
	assert.Equal(t, 3, cfg.MaxAttempts)
	assert.Equal(t, 1*time.Second, cfg.InitialDelay)
	assert.Equal(t, 30*time.Second, cfg.MaxDelay)
	assert.Equal(t, 2.0, cfg.BackoffFactor)
}

func TestDo_SuccessOnFirstAttempt(t *testing.T) {
	cfg := DefaultRetryConfig()
	attempts := 0

	err := Do(cfg, func() error {
		attempts++
		return nil
	}, "test operation")

	assert.NoError(t, err)
	assert.Equal(t, 1, attempts)
}

func TestDo_SuccessOnSecondAttempt(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  10 * time.Millisecond,
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,
	}

	attempts := 0
	err := Do(cfg, func() error {
		attempts++
		if attempts == 1 {
			return errors.New("first attempt failed")
		}
		return nil
	}, "test operation")

	assert.NoError(t, err)
	assert.Equal(t, 2, attempts)
}

func TestDo_FailAfterMaxAttempts(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  10 * time.Millisecond,
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,
	}

	attempts := 0
	expectedErr := errors.New("persistent error")
	err := Do(cfg, func() error {
		attempts++
		return expectedErr
	}, "test operation")

	assert.Error(t, err)
	assert.Equal(t, 3, attempts)
	assert.Contains(t, err.Error(), "test operation failed after 3 attempts")
}

func TestDo_ExponentialBackoff(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   4,
		InitialDelay:  10 * time.Millisecond,
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,
	}

	var callTimes []time.Time
	err := Do(cfg, func() error {
		callTimes = append(callTimes, time.Now())
		if len(callTimes) < cfg.MaxAttempts {
			return errors.New("try again")
		}
		return nil
	}, "test operation")

	assert.NoError(t, err)
	assert.Equal(t, 4, len(callTimes))

	if len(callTimes) >= 3 {
		delay1 := callTimes[1].Sub(callTimes[0])
		delay2 := callTimes[2].Sub(callTimes[1])

		assert.Greater(t, delay2, delay1/2)
		assert.Less(t, delay2, delay1*3)
	}
}

func TestDo_MaxDelayRespected(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  50 * time.Millisecond,
		MaxDelay:      80 * time.Millisecond,
		BackoffFactor: 10.0,
	}

	var callTimes []time.Time
	err := Do(cfg, func() error {
		callTimes = append(callTimes, time.Now())
		if len(callTimes) < cfg.MaxAttempts {
			return errors.New("try again")
		}
		return nil
	}, "test operation")

	assert.NoError(t, err)
	assert.Equal(t, 3, len(callTimes))

	if len(callTimes) >= 2 {
		delay := callTimes[1].Sub(callTimes[0])
		assert.Greater(t, delay, cfg.MaxDelay/2)
		assert.Less(t, delay, cfg.MaxDelay*2)
	}
}

func TestDo_SingleAttempt(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   1,
		InitialDelay:  10 * time.Millisecond,
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,
	}

	attempts := 0
	expectedErr := errors.New("failed")
	err := Do(cfg, func() error {
		attempts++
		return expectedErr
	}, "test operation")

	assert.Error(t, err)
	assert.Equal(t, 1, attempts)
}

func TestDo_ErrorWrapping(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   2,
		InitialDelay:  10 * time.Millisecond,
		MaxDelay:      100 * time.Millisecond,
		BackoffFactor: 2.0,
	}

	expectedErr := errors.New("original error")
	err := Do(cfg, func() error {
		return expectedErr
	}, "wrapper operation")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "wrapper operation failed")
	assert.Contains(t, err.Error(), "2 attempts")
}

func TestDo_Concurrent(t *testing.T) {
	cfg := DefaultRetryConfig()

	results := make(chan error, 10)
	for i := 0; i < 10; i++ {
		go func(id int) {
			attempts := 0
			err := Do(cfg, func() error {
				attempts++
				if attempts < 3 {
					return fmt.Errorf("attempt %d", id)
				}
				return nil
			}, fmt.Sprintf("operation %d", id))
			results <- err
		}(i)
	}

	for i := 0; i < 10; i++ {
		err := <-results
		assert.NoError(t, err)
	}
}

func TestDo_ZeroBackoff(t *testing.T) {
	cfg := RetryConfig{
		MaxAttempts:   3,
		InitialDelay:  0,
		MaxDelay:      0,
		BackoffFactor: 0,
	}

	attempts := 0
	err := Do(cfg, func() error {
		attempts++
		if attempts < cfg.MaxAttempts {
			return errors.New("fail")
		}
		return nil
	}, "test")

	assert.NoError(t, err)
	assert.Equal(t, 3, attempts)
}
