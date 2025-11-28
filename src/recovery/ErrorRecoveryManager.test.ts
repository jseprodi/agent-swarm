/**
 * ErrorRecoveryManager unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorRecoveryManager } from './ErrorRecoveryManager.js';
import { MockAgent } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('ErrorRecoveryManager', () => {
  let manager: ErrorRecoveryManager;

  beforeEach(() => {
    manager = new ErrorRecoveryManager();
  });

  describe('classifyError', () => {
    it('should classify transient errors', () => {
      const error = new Error('Network timeout');
      const classification = manager.classifyError(error);
      
      expect(classification.type).toBe('transient');
      expect(classification.shouldRetry).toBe(true);
      expect(classification.recoveryStrategy).toBe('retry');
    });

    it('should classify permanent errors', () => {
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      const classification = manager.classifyError(error);
      
      expect(classification.type).toBe('permanent');
      expect(classification.shouldRetry).toBe(false);
      expect(classification.recoveryStrategy).toBe('skip');
    });

    it('should classify recoverable errors', () => {
      const error = new Error('Service temporarily unavailable');
      const classification = manager.classifyError(error);
      
      expect(classification.type).toBe('recoverable');
      expect(classification.shouldRetry).toBe(true);
      expect(classification.recoveryStrategy).toBe('fallback');
    });
  });

  describe('getRetryPolicy', () => {
    it('should get or create policy', () => {
      const policy1 = manager.getRetryPolicy('agent-1');
      const policy2 = manager.getRetryPolicy('agent-1');
      
      expect(policy1).toBe(policy2);
    });

    it('should create separate policies for different agents', () => {
      const policy1 = manager.getRetryPolicy('agent-1');
      const policy2 = manager.getRetryPolicy('agent-2');
      
      expect(policy1).not.toBe(policy2);
    });
  });

  describe('getCircuitBreaker', () => {
    it('should get or create breaker', () => {
      const breaker1 = manager.getCircuitBreaker('agent-1');
      const breaker2 = manager.getCircuitBreaker('agent-1');
      
      expect(breaker1).toBe(breaker2);
    });
  });

  describe('recoverTask', () => {
    it('should return null for non-recoverable errors', async () => {
      const task = createTestTask('test');
      const agent = new MockAgent('agent-1');
      const error = new Error('Invalid');
      error.name = 'ValidationError';
      
      const result = await manager.recoverTask(task, error, agent, []);
      
      expect(result).toBeNull();
    });

    it('should retry with same agent for transient errors', async () => {
      const task = createTestTask('test');
      const agent = new MockAgent('agent-1');
      agent.setExecuteResult({ taskId: task.id, success: true, data: {} });
      const error = new Error('Network timeout');
      
      const result = await manager.recoverTask(task, error, agent, []);
      
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should try fallback agents', async () => {
      const task = createTestTask('test');
      const originalAgent = new MockAgent('agent-1');
      originalAgent.setExecuteError(new Error('Failed'));
      
      const fallbackAgent = new MockAgent('agent-2');
      fallbackAgent.setExecuteResult({ taskId: task.id, success: true, data: {} });
      
      const error = new Error('Service unavailable');
      const result = await manager.recoverTask(task, error, originalAgent, [fallbackAgent]);
      
      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it('should return null on all failures', async () => {
      const task = createTestTask('test');
      const agent = new MockAgent('agent-1');
      agent.setExecuteError(new Error('Persistent failure'));
      const error = new Error('Network error');
      
      const result = await manager.recoverTask(task, error, agent, []);
      
      expect(result).toBeNull();
    });
  });

  describe('getErrorStats', () => {
    it('should return statistics', async () => {
      const task = createTestTask('test');
      const agent = new MockAgent('agent-1');
      const error = new Error('Test error');
      
      await manager.recoverTask(task, error, agent, []);
      
      const stats = manager.getErrorStats();
      expect(stats.totalErrors).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      manager.getRetryPolicy('agent-1');
      manager.getCircuitBreaker('agent-1');
      
      manager.reset();
      
      const stats = manager.getErrorStats();
      expect(stats.totalErrors).toBe(0);
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      manager.on('reset', handler);
      
      manager.reset();
      
      expect(handler).toHaveBeenCalled();
    });
  });
});

