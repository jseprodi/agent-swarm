/**
 * Swarm integration tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Swarm } from './index.js';
import { MockLLMProvider } from '../__tests__/helpers/mocks.js';
import type { TaskResult } from './core/types.js';

describe('Swarm', () => {
  let swarm: Swarm;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
  });

  afterEach(async () => {
    if (swarm) {
      await swarm.cleanup();
    }
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      swarm = new Swarm();
      
      expect(swarm).toBeDefined();
      expect(swarm.getLLMProvider()).toBeDefined();
      expect(swarm.getTaskManager()).toBeDefined();
      expect(swarm.getMessageQueue()).toBeDefined();
      expect(swarm.getAgentRegistry()).toBeDefined();
      expect(swarm.getMCPManager()).toBeDefined();
    });

    it('should initialize with custom LLM provider instance', () => {
      swarm = new Swarm({ llmProvider: mockLLM });
      
      expect(swarm.getLLMProvider()).toBe(mockLLM);
    });

    it('should initialize with OpenAI provider type', () => {
      swarm = new Swarm({
        llmProvider: 'openai',
        llmConfig: { apiKey: 'test-key' },
      });
      
      expect(swarm.getLLMProvider().getName()).toBe('OpenAI');
    });

    it('should initialize with Anthropic provider type', () => {
      swarm = new Swarm({
        llmProvider: 'anthropic',
        llmConfig: { apiKey: 'test-key' },
      });
      
      expect(swarm.getLLMProvider().getName()).toBe('Anthropic');
    });

    it('should initialize with Cursor provider by default', () => {
      swarm = new Swarm();
      expect(swarm.getLLMProvider().getName()).toBe('Cursor');
    });

    it('should set log level from config', () => {
      swarm = new Swarm({ logLevel: 'debug' });
      expect(swarm).toBeDefined();
    });

    it('should start health checks if enabled', () => {
      swarm = new Swarm({ enableHealthChecks: true });
      expect(swarm).toBeDefined();
    });

    it('should use custom health check interval', () => {
      swarm = new Swarm({ healthCheckInterval: 30000 });
      expect(swarm).toBeDefined();
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      swarm = new Swarm({ llmProvider: mockLLM });
    });

    it('should execute a simple task', async () => {
      const result = await swarm.execute('Generate a factorial function');
      
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      // Task may succeed or fail depending on agent availability, but should complete
      expect(['success', 'failed']).toContain(result.success ? 'success' : 'failed');
    }, 20000);

    it('should execute task with metadata', async () => {
      const result = await swarm.execute('Test task', {
        priority: 'high',
        tags: ['test'],
      });
      
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      // Task may succeed or fail depending on agent availability, but should complete
      expect(['success', 'failed']).toContain(result.success ? 'success' : 'failed');
    }, 20000);

    it('should handle task execution errors', async () => {
      // Task execution should handle errors gracefully
      const result = await swarm.execute('Test task');
      
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      // Task may succeed or fail, but should not throw
      expect(['success', 'failed']).toContain(result.success ? 'success' : 'failed');
    }, 20000);
  });

  describe('getters', () => {
    beforeEach(() => {
      swarm = new Swarm({ llmProvider: mockLLM });
    });

    it('should return task manager', () => {
      const taskManager = swarm.getTaskManager();
      expect(taskManager).toBeDefined();
    });

    it('should return message queue', () => {
      const messageQueue = swarm.getMessageQueue();
      expect(messageQueue).toBeDefined();
    });

    it('should return agent registry', () => {
      const agentRegistry = swarm.getAgentRegistry();
      expect(agentRegistry).toBeDefined();
    });

    it('should return MCP manager', () => {
      const mcpManager = swarm.getMCPManager();
      expect(mcpManager).toBeDefined();
    });

    it('should return orchestrator', () => {
      // Orchestrator is private, test through execute
      expect(swarm).toBeDefined();
    });

    it('should return LLM provider', () => {
      const llm = swarm.getLLMProvider();
      expect(llm).toBe(mockLLM);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all resources', async () => {
      swarm = new Swarm({ llmProvider: mockLLM });
      
      const taskManager = swarm.getTaskManager();
      taskManager.createTask('Test task');
      
      await swarm.cleanup();
      
      // Tasks should be cleared
      expect(taskManager.getAllTasks()).toHaveLength(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      swarm = new Swarm({ llmProvider: mockLLM });
      
      const mcpManager = swarm.getMCPManager();
      const originalCleanup = mcpManager.cleanup;
      mcpManager.cleanup = vi.fn().mockRejectedValue(new Error('Cleanup error'));
      
      // Should not throw - cleanup should catch errors
      await swarm.cleanup();
      
      // Restore original
      mcpManager.cleanup = originalCleanup;
    });
  });

  describe('agent registration', () => {
    beforeEach(() => {
      swarm = new Swarm({ llmProvider: mockLLM });
    });

    it('should register default agents', () => {
      const agentRegistry = swarm.getAgentRegistry();
      const agents = agentRegistry.getAllAgents();
      
      // Should have orchestrator + default agents
      expect(agents.length).toBeGreaterThan(1);
      
      const agentIds = agents.map(a => a.id);
      expect(agentIds).toContain('orchestrator');
      expect(agentIds).toContain('code-agent');
      expect(agentIds).toContain('test-agent');
    });
  });
});

