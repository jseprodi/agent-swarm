/**
 * RetryStrategy unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExponentialBackoffRetry,
  FixedIntervalRetry,
  AdaptiveRetry,
  RetryExecutor,
} from './RetryStrategy.js';

describe('ExponentialBackoffRetry', () => {
  let retry: ExponentialBackoffRetry;

  beforeEach(() => {
    retry = new ExponentialBackoffRetry(3, 100, 1000, 2);
  });

  describe('shouldRetry', () => {
    it('should return true for transient errors', () => {
      const error = new Error('Network timeout');
      expect(retry.shouldRetry(0, error)).toBe(true);
      expect(retry.shouldRetry(1, error)).toBe(true);
    });

    it('should return false for permanent errors', () => {
      const validationError = new Error('Invalid input');
      validationError.name = 'ValidationError';
      expect(retry.shouldRetry(0, validationError)).toBe(false);
    });

    it('should respect max attempts', () => {
      const error = new Error('Transient error');
      expect(retry.shouldRetry(3, error)).toBe(false);
    });
  });

  describe('getDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay0 = retry.getDelay(0);
      const delay1 = retry.getDelay(1);
      const delay2 = retry.getDelay(2);
      
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it('should respect max delay', () => {
      const delay = retry.getDelay(10); // Should be capped at maxDelay
      // Note: jitter can add up to 30% more, so we allow some tolerance
      expect(delay).toBeLessThanOrEqual(1300); // maxDelay + 30% jitter
    });

    it('should include jitter', () => {
      const delays = Array.from({ length: 10 }, () => retry.getDelay(1));
      // All delays should be different due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('getMaxAttempts', () => {
    it('should return max attempts', () => {
      expect(retry.getMaxAttempts()).toBe(3);
    });
  });
});

describe('FixedIntervalRetry', () => {
  let retry: FixedIntervalRetry;

  beforeEach(() => {
    retry = new FixedIntervalRetry(3, 500);
  });

  describe('shouldRetry', () => {
    it('should retry transient errors', () => {
      const error = new Error('Temporary failure');
      expect(retry.shouldRetry(0, error)).toBe(true);
    });

    it('should not retry permanent errors', () => {
      const error = new Error('Invalid');
      error.name = 'ValidationError';
      expect(retry.shouldRetry(0, error)).toBe(false);
    });
  });

  describe('getDelay', () => {
    it('should return fixed delay', () => {
      expect(retry.getDelay(0)).toBe(500);
      expect(retry.getDelay(1)).toBe(500);
      expect(retry.getDelay(2)).toBe(500);
    });
  });
});

describe('AdaptiveRetry', () => {
  let retry: AdaptiveRetry;

  beforeEach(() => {
    retry = new AdaptiveRetry(3, 100, 1000);
  });

  describe('shouldRetry', () => {
    it('should retry transient errors', () => {
      const error = new Error('Network timeout');
      expect(retry.shouldRetry(0, error)).toBe(true);
    });

    it('should not retry permanent errors', () => {
      const error = new Error('Invalid');
      error.name = 'ValidationError';
      expect(retry.shouldRetry(0, error)).toBe(false);
    });

    it('should track error history', () => {
      const error = new Error('Network error');
      retry.shouldRetry(0, error);
      retry.shouldRetry(1, error);
      
      // Error history should be tracked
      expect((retry as any).errorHistory.length).toBeGreaterThan(0);
    });
  });

  describe('getDelay', () => {
    it('should adapt delay based on error frequency', () => {
      const error = new Error('Network error');
      
      // Record multiple errors
      for (let i = 0; i < 5; i++) {
        retry.shouldRetry(i, error);
      }
      
      const delay = retry.getDelay(1);
      expect(delay).toBeGreaterThan(0);
    });
  });
});

describe('RetryExecutor', () => {
  describe('execute', () => {
    it('should execute successfully on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const policy = new FixedIntervalRetry(3, 10);
      
      const result = await RetryExecutor.execute(fn, policy);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');
      const policy = new FixedIntervalRetry(3, 10);
      
      const result = await RetryExecutor.execute(fn, policy);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect retry policy', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));
      const policy = new FixedIntervalRetry(2, 10);
      
      await expect(RetryExecutor.execute(fn, policy)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValue('success');
      const policy = new FixedIntervalRetry(3, 10);
      const onRetry = vi.fn();
      
      await RetryExecutor.execute(fn, policy, onRetry);
      
      expect(onRetry).toHaveBeenCalled();
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), 10);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      const policy = new FixedIntervalRetry(2, 10);
      
      await expect(RetryExecutor.execute(fn, policy)).rejects.toThrow('Persistent failure');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

