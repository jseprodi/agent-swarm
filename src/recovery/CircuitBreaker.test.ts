/**
 * CircuitBreaker unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from './CircuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 2000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultBreaker = new CircuitBreaker();
      expect(defaultBreaker.getState()).toBe('closed');
    });

    it('should initialize with custom config', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute successfully in closed state', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(fn);
      
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should transition to open on failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));
      
      // Fail multiple times to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('open');
      expect(breaker.getFailureCount()).toBe(3);
    });

    it('should reject in open state', async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      // Try to execute when open
      await expect(breaker.execute(() => Promise.resolve('test'))).rejects.toThrow('Circuit breaker is open');
    });

    it('should transition to half-open after timeout', async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('open');
      
      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Next execution should transition to half-open
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      
      expect(breaker.getState()).toBe('half-open');
    });

    it('should close from half-open on success', async () => {
      // Open and transition to half-open
      const failFn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Succeed enough times to close
      const successFn = vi.fn().mockResolvedValue('success');
      for (let i = 0; i < 2; i++) {
        await breaker.execute(successFn);
      }
      
      expect(breaker.getState()).toBe('closed');
    });

    it('should open from half-open on failure', async () => {
      // Get to half-open state
      const failFn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Fail in half-open state
      try {
        await breaker.execute(failFn);
      } catch (e) {
        // Expected
      }
      
      expect(breaker.getState()).toBe('open');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('getFailureCount', () => {
    it('should return failure count', () => {
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      breaker.reset();
      expect(breaker.getState()).toBe('closed');
      expect(breaker.getFailureCount()).toBe(0);
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      breaker.on('reset', handler);
      
      breaker.reset();
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should emit open event', async () => {
      const handler = vi.fn();
      breaker.on('open', handler);
      
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }
      
      expect(handler).toHaveBeenCalled();
    });

    it('should emit half-open event', async () => {
      const handler = vi.fn();
      breaker.on('half-open', handler);
      
      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should emit closed event', async () => {
      const handler = vi.fn();
      breaker.on('closed', handler);
      
      // Get to half-open and then close
      const failFn = vi.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const successFn = vi.fn().mockResolvedValue('success');
      for (let i = 0; i < 2; i++) {
        await breaker.execute(successFn);
      }
      
      expect(handler).toHaveBeenCalled();
    });
  });
});

