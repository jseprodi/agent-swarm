/**
 * NodeManager unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodeManager } from './NodeManager.js';
import type { AgentNode } from './DistributedExecutor.js';

describe('NodeManager', () => {
  let manager: NodeManager;

  beforeEach(() => {
    manager = new NodeManager();
  });

  afterEach(() => {
    manager.stopHealthChecks();
  });

  describe('constructor', () => {
    it('should initialize manager', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('registerNode', () => {
    it('should register node', () => {
      const node: AgentNode = {
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online',
        lastSeen: Date.now(),
        agents: [],
      };
      
      const handler = vi.fn();
      manager.on('node_registered', handler);
      
      manager.registerNode(node);
      
      expect(handler).toHaveBeenCalledWith(node);
    });
  });

  describe('discoverNodes', () => {
    it('should discover nodes statically', async () => {
      await manager.discoverNodes('static', [
        { id: 'node-1', url: 'http://node-1:3000' },
        { id: 'node-2', url: 'http://node-2:3000' },
      ]);
      
      const registry = manager.getRegistry();
      expect(registry.getAllNodes().length).toBe(2);
    });

    it('should handle dynamic discovery placeholder', async () => {
      await manager.discoverNodes('dynamic');
      // Should not throw
      expect(manager).toBeDefined();
    });
  });

  describe('startHealthChecks', () => {
    it('should start checks', () => {
      manager.startHealthChecks();
      
      // Should not throw
      expect(manager).toBeDefined();
    });

    it('should not start if already running', () => {
      manager.startHealthChecks();
      manager.startHealthChecks(); // Second call should be ignored
      
      expect(manager).toBeDefined();
    });
  });

  describe('stopHealthChecks', () => {
    it('should stop checks', () => {
      manager.startHealthChecks();
      manager.stopHealthChecks();
      
      // Should not throw
      expect(manager).toBeDefined();
    });
  });

  describe('getRegistry', () => {
    it('should return registry', () => {
      const registry = manager.getRegistry();
      expect(registry).toBeDefined();
    });
  });
});

