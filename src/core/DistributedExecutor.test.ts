/**
 * DistributedExecutor unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteAgentProxy, NodeRegistry, TaskDispatcher } from './DistributedExecutor.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('RemoteAgentProxy', () => {
  let proxy: RemoteAgentProxy;

  beforeEach(() => {
    proxy = new RemoteAgentProxy(
      'remote-agent-1',
      'Remote Agent',
      'Test remote agent',
      ['code_generation'],
      'node-1',
      'http://node-1:3000'
    );
  });

  describe('constructor', () => {
    it('should initialize proxy', () => {
      expect(proxy.id).toBe('remote-agent-1');
      expect(proxy.getNodeId()).toBe('node-1');
      expect(proxy.getNodeUrl()).toBe('http://node-1:3000');
    });
  });

  describe('canHandle', () => {
    it('should check capabilities', () => {
      const task = createTestTask('test', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      expect(proxy.canHandle(task)).toBe(true);
    });

    it('should return false for missing capabilities', () => {
      const task = createTestTask('test', 'pending', {
        requiredCapabilities: ['test_generation'],
      });
      
      expect(proxy.canHandle(task)).toBe(false);
    });
  });

  describe('getNodeId', () => {
    it('should return node ID', () => {
      expect(proxy.getNodeId()).toBe('node-1');
    });
  });

  describe('getNodeUrl', () => {
    it('should return node URL', () => {
      expect(proxy.getNodeUrl()).toBe('http://node-1:3000');
    });
  });
});

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  describe('registerNode', () => {
    it('should register node', () => {
      const node = {
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online' as const,
        lastSeen: Date.now(),
        agents: [],
      };
      
      registry.registerNode(node);
      expect(registry.getNode('node-1')).toBeDefined();
    });
  });

  describe('getNode', () => {
    it('should retrieve node', () => {
      const node = {
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online' as const,
        lastSeen: Date.now(),
        agents: [],
      };
      
      registry.registerNode(node);
      const retrieved = registry.getNode('node-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('node-1');
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes', () => {
      registry.registerNode({
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online',
        lastSeen: Date.now(),
        agents: [],
      });
      
      const nodes = registry.getAllNodes();
      expect(nodes.length).toBe(1);
    });
  });

  describe('getOnlineNodes', () => {
    it('should filter online nodes', () => {
      registry.registerNode({
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online',
        lastSeen: Date.now(),
        agents: [],
      });
      registry.registerNode({
        id: 'node-2',
        url: 'http://node-2:3000',
        status: 'offline',
        lastSeen: Date.now(),
        agents: [],
      });
      
      const online = registry.getOnlineNodes();
      expect(online.length).toBe(1);
      expect(online[0].id).toBe('node-1');
    });
  });

  describe('updateNodeStatus', () => {
    it('should update status', () => {
      const node = {
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online' as const,
        lastSeen: Date.now(),
        agents: [],
      };
      
      registry.registerNode(node);
      registry.updateNodeStatus('node-1', 'offline');
      
      const updated = registry.getNode('node-1');
      expect(updated?.status).toBe('offline');
    });
  });

  describe('removeNode', () => {
    it('should remove node', () => {
      const node = {
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online' as const,
        lastSeen: Date.now(),
        agents: [],
      };
      
      registry.registerNode(node);
      registry.removeNode('node-1');
      
      expect(registry.getNode('node-1')).toBeUndefined();
    });
  });
});

describe('TaskDispatcher', () => {
  let dispatcher: TaskDispatcher;
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
    dispatcher = new TaskDispatcher(registry);
  });

  describe('findSuitableNode', () => {
    it('should find node for task', () => {
      registry.registerNode({
        id: 'node-1',
        url: 'http://node-1:3000',
        status: 'online',
        lastSeen: Date.now(),
        agents: [{ id: 'agent-1', name: 'Agent', description: 'Test', capabilities: ['code_generation'] }],
      });
      
      const task = createTestTask('test', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      const node = dispatcher.findSuitableNode(task);
      expect(node).toBeDefined();
    });

    it('should return null if no nodes', () => {
      const task = createTestTask('test');
      const node = dispatcher.findSuitableNode(task);
      
      expect(node).toBeNull();
    });
  });
});

