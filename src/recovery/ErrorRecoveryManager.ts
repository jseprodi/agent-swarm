/**
 * Error Recovery Manager - Coordinates error recovery strategies
 */

import { EventEmitter } from 'events';
import type { Task, TaskResult } from '../core/types.js';
import type { Agent } from '../core/types.js';
import { RetryExecutor } from './RetryStrategy.js';
import type { RetryPolicy } from './RetryStrategy.js';
import { ExponentialBackoffRetry } from './RetryStrategy.js';
import { CircuitBreaker } from './CircuitBreaker.js';
import logger from '../utils/logger.js';

/**
 * Error classification
 */
export type ErrorType = 'transient' | 'permanent' | 'recoverable';

/**
 * Error classification result
 */
export interface ErrorClassification {
  type: ErrorType;
  shouldRetry: boolean;
  recoveryStrategy?: 'retry' | 'fallback' | 'skip';
  estimatedRecoveryTime?: number;
}

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager extends EventEmitter {
  private retryPolicies: Map<string, RetryPolicy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorHistory: Array<{ taskId: string; error: string; timestamp: number; recovered: boolean }> = [];

  constructor() {
    super();
  }

  /**
   * Classify error type
   */
  classifyError(error: Error, task?: Task): ErrorClassification {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Permanent errors - don't retry
    if (
      errorName.includes('validation') ||
      errorName.includes('authentication') ||
      errorName.includes('authorization') ||
      errorMessage.includes('invalid input') ||
      errorMessage.includes('not found')
    ) {
      return {
        type: 'permanent',
        shouldRetry: false,
        recoveryStrategy: 'skip',
      };
    }

    // Transient errors - retry
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('rate limit')
    ) {
      return {
        type: 'transient',
        shouldRetry: true,
        recoveryStrategy: 'retry',
        estimatedRecoveryTime: 5000, // 5 seconds
      };
    }

    // Recoverable errors - try fallback
    return {
      type: 'recoverable',
      shouldRetry: true,
      recoveryStrategy: 'fallback',
      estimatedRecoveryTime: 10000, // 10 seconds
    };
  }

  /**
   * Get or create retry policy for agent
   */
  getRetryPolicy(agentId: string, strategy: 'exponential' | 'fixed' | 'adaptive' = 'exponential'): RetryPolicy {
    const key = `${agentId}_${strategy}`;
    if (!this.retryPolicies.has(key)) {
      let policy: RetryPolicy;
      switch (strategy) {
        case 'exponential':
          policy = new ExponentialBackoffRetry(3, 1000, 30000);
          break;
        case 'fixed':
          policy = new ExponentialBackoffRetry(3, 2000); // Using ExponentialBackoffRetry with fixed-like config
          break;
        default:
          policy = new ExponentialBackoffRetry(3, 1000, 30000);
      }
      this.retryPolicies.set(key, policy);
    }
    return this.retryPolicies.get(key)!;
  }

  /**
   * Get or create circuit breaker for agent
   */
  getCircuitBreaker(agentId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(agentId)) {
      const breaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000,
      });
      this.circuitBreakers.set(agentId, breaker);
    }
    return this.circuitBreakers.get(agentId)!;
  }

  /**
   * Attempt to recover from task failure
   */
  async recoverTask(
    task: Task,
    originalError: Error,
    originalAgent: Agent,
    fallbackAgents: Agent[]
  ): Promise<TaskResult | null> {
    const classification = this.classifyError(originalError, task);

    // Record error
    this.errorHistory.push({
      taskId: task.id,
      error: originalError.message,
      timestamp: Date.now(),
      recovered: false,
    });

    if (this.errorHistory.length > 1000) {
      this.errorHistory.shift();
    }

    if (!classification.shouldRetry) {
      logger.debug(`Task ${task.id} error is not recoverable: ${classification.type}`);
      return null;
    }

    // Try retry with same agent
    if (classification.recoveryStrategy === 'retry') {
      const policy = this.getRetryPolicy(originalAgent.id);
      const circuitBreaker = this.getCircuitBreaker(originalAgent.id);

      try {
        const result = await circuitBreaker.execute(async () => {
          return await RetryExecutor.execute(
            async () => {
              return await originalAgent.execute(task);
            },
            policy,
            (attempt, error, delay) => {
              logger.info(`Retrying task ${task.id} with agent ${originalAgent.id} (attempt ${attempt})`);
            }
          );
        });

        // Mark as recovered
        const errorEntry = this.errorHistory.find(e => e.taskId === task.id && !e.recovered);
        if (errorEntry) {
          errorEntry.recovered = true;
        }

        this.emit('recovered', { taskId: task.id, agentId: originalAgent.id, strategy: 'retry' });
        return result;
      } catch (retryError) {
        logger.warn(`Retry failed for task ${task.id}:`, retryError);
      }
    }

    // Try fallback agents
    if (classification.recoveryStrategy === 'fallback' && fallbackAgents.length > 0) {
      for (const fallbackAgent of fallbackAgents) {
        try {
          logger.info(`Trying fallback agent ${fallbackAgent.id} for task ${task.id}`);
          const result = await fallbackAgent.execute(task);

          if (result.success) {
            const errorEntry = this.errorHistory.find(e => e.taskId === task.id && !e.recovered);
            if (errorEntry) {
              errorEntry.recovered = true;
            }

            this.emit('recovered', { taskId: task.id, agentId: fallbackAgent.id, strategy: 'fallback' });
            return result;
          }
        } catch (fallbackError) {
          logger.warn(`Fallback agent ${fallbackAgent.id} failed for task ${task.id}:`, fallbackError);
        }
      }
    }

    // All recovery attempts failed
    logger.error(`Failed to recover task ${task.id} after all attempts`);
    return null;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    recovered: number;
    recoveryRate: number;
    errorsByType: Record<ErrorType, number>;
  } {
    const totalErrors = this.errorHistory.length;
    const recovered = this.errorHistory.filter(e => e.recovered).length;
    const recoveryRate = totalErrors > 0 ? recovered / totalErrors : 0;

    const errorsByType: Record<ErrorType, number> = {
      transient: 0,
      permanent: 0,
      recoverable: 0,
    };

    // This would require storing error classifications, simplified for now
    return {
      totalErrors,
      recovered,
      recoveryRate,
      errorsByType,
    };
  }

  /**
   * Reset error history
   */
  reset(): void {
    this.errorHistory = [];
    this.retryPolicies.clear();
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
    this.emit('reset');
  }
}

