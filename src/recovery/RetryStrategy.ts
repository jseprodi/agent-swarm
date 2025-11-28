/**
 * Retry Strategy - Different retry policies for error recovery
 */

import logger from '../utils/logger.js';

/**
 * Retry policy interface
 */
export interface RetryPolicy {
  shouldRetry(attempt: number, error: Error): boolean;
  getDelay(attempt: number): number;
  getMaxAttempts(): number;
}

/**
 * Exponential backoff retry strategy
 */
export class ExponentialBackoffRetry implements RetryPolicy {
  private maxAttempts: number;
  private baseDelay: number; // milliseconds
  private maxDelay: number; // milliseconds
  private multiplier: number;

  constructor(maxAttempts: number = 3, baseDelay: number = 1000, maxDelay: number = 30000, multiplier: number = 2) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.multiplier = multiplier;
  }

  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxAttempts) {
      return false;
    }

    // Don't retry on certain error types
    if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
      return false;
    }

    return true;
  }

  getDelay(attempt: number): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.multiplier, attempt),
      this.maxDelay
    );
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }
}

/**
 * Fixed interval retry strategy
 */
export class FixedIntervalRetry implements RetryPolicy {
  private maxAttempts: number;
  private delay: number;

  constructor(maxAttempts: number = 3, delay: number = 1000) {
    this.maxAttempts = maxAttempts;
    this.delay = delay;
  }

  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxAttempts) {
      return false;
    }

    if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
      return false;
    }

    return true;
  }

  getDelay(attempt: number): number {
    return this.delay;
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }
}

/**
 * Adaptive retry strategy - uses LLM to determine retry strategy
 */
export class AdaptiveRetry implements RetryPolicy {
  private maxAttempts: number;
  private baseDelay: number;
  private maxDelay: number;
  private errorHistory: Array<{ error: string; timestamp: number; retried: boolean }> = [];

  constructor(maxAttempts: number = 3, baseDelay: number = 1000, maxDelay: number = 30000) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxAttempts) {
      return false;
    }

    // Record error
    this.errorHistory.push({
      error: error.message,
      timestamp: Date.now(),
      retried: false,
    });

    // Keep only last 100 errors
    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    // Don't retry permanent errors
    if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
      return false;
    }

    // Check if this is a transient error (network, timeout, etc.)
    const transientPatterns = ['timeout', 'network', 'connection', 'ECONNREFUSED', 'ETIMEDOUT'];
    const isTransient = transientPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );

    return isTransient;
  }

  getDelay(attempt: number): number {
    // Adaptive delay based on error frequency
    const recentErrors = this.errorHistory.filter(
      e => Date.now() - e.timestamp < 60000 // Last minute
    ).length;

    // Increase delay if many recent errors
    const multiplier = Math.min(1 + recentErrors * 0.2, 3);
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attempt) * multiplier,
      this.maxDelay
    );

    const jitter = Math.random() * 0.3 * delay;
    return Math.floor(delay + jitter);
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }
}

/**
 * Retry executor - executes function with retry logic
 */
export class RetryExecutor {
  /**
   * Execute function with retry policy
   */
  static async execute<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy,
    onRetry?: (attempt: number, error: Error, delay: number) => void
  ): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < policy.getMaxAttempts()) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (!policy.shouldRetry(attempt, lastError)) {
          throw lastError;
        }

        const delay = policy.getDelay(attempt - 1);
        if (onRetry) {
          onRetry(attempt, lastError, delay);
        }

        logger.debug(`Retry attempt ${attempt}/${policy.getMaxAttempts()} after ${delay}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

