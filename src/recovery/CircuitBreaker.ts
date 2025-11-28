/**
 * Circuit Breaker - Prevents cascading failures
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes needed to close from half-open
  timeout: number; // Time in ms before attempting to close from open
  resetTimeout: number; // Time in ms before resetting failure count
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = 'closed';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute
      resetTimeout: config.resetTimeout || 300000, // 5 minutes
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.timeout) {
        this.transitionToHalfOpen();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.emit('reset');
    logger.debug('Circuit breaker reset');
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      // Reset failure count after reset timeout
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.failureCount = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      // Any failure in half-open state opens the circuit
      this.transitionToOpen();
    } else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen();
    }
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = 'open';
    this.successCount = 0;
    this.emit('open', this.failureCount);
    logger.warn(`Circuit breaker opened after ${this.failureCount} failures`);
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = 'half-open';
    this.successCount = 0;
    this.emit('half-open');
    logger.info('Circuit breaker transitioning to half-open state');
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.emit('closed');
    logger.info('Circuit breaker closed - service is healthy');
  }
}

