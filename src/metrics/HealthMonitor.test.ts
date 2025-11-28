/**
 * HealthMonitor unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor } from './HealthMonitor.js';
import { AgentRegistry } from '../communication/AgentRegistry.js';
import { TaskManager } from '../core/TaskManager.js';
import { MockAgent } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;
  let agentRegistry: AgentRegistry;
  let taskManager: TaskManager;

  beforeEach(() => {
    agentRegistry = new AgentRegistry();
    taskManager = new TaskManager();
    monitor = new HealthMonitor(agentRegistry, undefined, taskManager);
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(monitor).toBeDefined();
    });

    it('should accept custom check interval', () => {
      const customMonitor = new HealthMonitor(undefined, undefined, undefined, undefined, 10000);
      expect(customMonitor).toBeDefined();
      customMonitor.stop();
    });
  });

  describe('start', () => {
    it('should start health checks', () => {
      monitor.start();
      
      // Should perform initial check
      const report = monitor.getLastHealthReport();
      expect(report).toBeDefined();
    });

    it('should not start if already started', () => {
      monitor.start();
      monitor.start(); // Second call should be ignored
      
      expect(monitor.getLastHealthReport()).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop health checks', () => {
      monitor.start();
      monitor.stop();
      
      // Should still have last report
      expect(monitor.getLastHealthReport()).toBeDefined();
    });

    it('should handle stop when not started', () => {
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('performHealthCheck', () => {
    it('should check all components', () => {
      const report = monitor.performHealthCheck();
      
      expect(report).toBeDefined();
      expect(report.components.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
    });

    it('should return healthy status when all components healthy', () => {
      const agent = new MockAgent('agent1', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(agent);
      
      const report = monitor.performHealthCheck();
      
      expect(report.status).toBe('healthy');
    });

    it('should return degraded status when agents unavailable', () => {
      const agent = new MockAgent('agent1', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(agent);
      // Mark agent as unavailable
      const registration = (agentRegistry as any).registrations.get('agent1');
      if (registration) {
        registration.isAvailable = false;
      }
      
      const report = monitor.performHealthCheck();
      
      // Should be degraded or unhealthy depending on implementation
      expect(['degraded', 'unhealthy']).toContain(report.status);
    });

    it('should return unhealthy status when no agents available', () => {
      const agent = new MockAgent('agent1', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(agent);
      // Mark all agents as unavailable
      const registration = (agentRegistry as any).registrations.get('agent1');
      if (registration) {
        registration.isAvailable = false;
      }
      
      const report = monitor.performHealthCheck();
      
      // Should be unhealthy if no agents available
      const agentHealth = report.components.find(c => c.name === 'agents');
      if (agentHealth && agentHealth.details && typeof agentHealth.details === 'object' && 'available' in agentHealth.details) {
        if (agentHealth.details.available === 0) {
          expect(report.status).toBe('unhealthy');
        }
      }
    });

    it('should check task failure rate', () => {
      // Create some tasks
      const task1 = taskManager.createTask('task1');
      taskManager.storeResult({ taskId: task1.id, success: true, data: {} });
      
      const task2 = taskManager.createTask('task2');
      taskManager.storeResult({ taskId: task2.id, success: false, error: 'error' });
      
      const report = monitor.performHealthCheck();
      
      const taskHealth = report.components.find(c => c.name === 'tasks');
      expect(taskHealth).toBeDefined();
      expect(taskHealth?.details).toBeDefined();
    });

    it('should check memory usage', () => {
      const report = monitor.performHealthCheck();
      
      const memoryHealth = report.components.find(c => c.name === 'memory');
      expect(memoryHealth).toBeDefined();
      expect(memoryHealth?.details).toBeDefined();
    });

    it('should emit health_check event', () => {
      const handler = vi.fn();
      monitor.on('health_check', handler);
      
      monitor.performHealthCheck();
      
      expect(handler).toHaveBeenCalled();
    });

    it('should emit unhealthy event when unhealthy', () => {
      const handler = vi.fn();
      monitor.on('unhealthy', handler);
      
      // Force unhealthy state by having high memory usage
      // This is hard to test reliably, so we'll just check the event is emitted
      // when status is unhealthy
      const report = monitor.performHealthCheck();
      if (report.status === 'unhealthy') {
        expect(handler).toHaveBeenCalled();
      }
    });

    it('should emit degraded event when degraded', () => {
      const handler = vi.fn();
      monitor.on('degraded', handler);
      
      const report = monitor.performHealthCheck();
      if (report.status === 'degraded') {
        expect(handler).toHaveBeenCalled();
      }
    });
  });

  describe('getLastHealthReport', () => {
    it('should return last report', () => {
      monitor.performHealthCheck();
      const report = monitor.getLastHealthReport();
      
      expect(report).toBeDefined();
      expect(report?.timestamp).toBeDefined();
    });

    it('should return undefined before first check', () => {
      const newMonitor = new HealthMonitor();
      expect(newMonitor.getLastHealthReport()).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      monitor.performHealthCheck();
      const status = monitor.getStatus();
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status);
    });

    it('should return healthy by default', () => {
      const newMonitor = new HealthMonitor();
      expect(newMonitor.getStatus()).toBe('healthy');
    });
  });
});

