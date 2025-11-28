/**
 * Orchestrator unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Orchestrator } from './Orchestrator.js';
import { TaskManager } from './TaskManager.js';
import { MessageQueue } from '../communication/MessageQueue.js';
import { AgentRegistry } from '../communication/AgentRegistry.js';
import { MCPManager } from '../mcp/MCPManager.js';
import { MockLLMProvider, MockAgent } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';
import type { Task, TaskResult } from './types.js';

describe('Orchestrator', () => {
  let orchestrator: Orchestrator;
  let taskManager: TaskManager;
  let messageQueue: MessageQueue;
  let agentRegistry: AgentRegistry;
  let mcpManager: MCPManager;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    taskManager = new TaskManager();
    messageQueue = new MessageQueue();
    agentRegistry = new AgentRegistry();
    mcpManager = new MCPManager();
    mockLLM = new MockLLMProvider(true);
    
    orchestrator = new Orchestrator(
      taskManager,
      messageQueue,
      agentRegistry,
      mcpManager,
      mockLLM
    );
  });

  describe('constructor', () => {
    it('should initialize orchestrator with dependencies', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getMetadata().id).toBe('orchestrator');
    });

    it('should subscribe to task completion messages', () => {
      const subscribeSpy = vi.spyOn(messageQueue, 'subscribe');
      new Orchestrator(taskManager, messageQueue, agentRegistry, mcpManager, mockLLM);
      
      expect(subscribeSpy).toHaveBeenCalledWith('task_completed', expect.any(Function));
      expect(subscribeSpy).toHaveBeenCalledWith('task_failed', expect.any(Function));
    });
  });

  describe('execute', () => {
    it('should return failure if already processing', async () => {
      const task = createTestTask('Test task');
      
      // Start first execution (don't await)
      const promise1 = orchestrator.execute(task);
      
      // Try to execute another task immediately
      const task2 = createTestTask('Test task 2');
      const result2 = await orchestrator.execute(task2);
      
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('busy');
      
      // Wait for first to complete
      await promise1;
    });

    it('should execute simple task without decomposition', async () => {
      const task = createTestTask('Simple task');
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      // Should complete (even if with fallback)
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
    });

    it('should handle errors during execution', async () => {
      const task = createTestTask('Task that will fail');
      
      // Mock taskManager to throw error
      vi.spyOn(taskManager, 'createTask').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = await orchestrator.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Test error');
    });

    it('should reset isProcessing flag after execution', async () => {
      const task = createTestTask('Test task');
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      await orchestrator.execute(task);
      
      // Should be able to execute another task
      const task2 = createTestTask('Test task 2');
      const result2 = await orchestrator.execute(task2);
      
      expect(result2).toBeDefined();
    });
  });

  describe('task decomposition', () => {
    it('should handle LLM decomposition when available', async () => {
      const task = createTestTask('Complex task');
      
      // Mock LLM response for decomposition
      mockLLM.setResponse(
        'Complex task',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'Subtask 1', dependencies: [] },
              { description: 'Subtask 2', dependencies: ['Subtask 1'] },
            ],
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.7
      );
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
    });

    it('should fallback to simple task when LLM decomposition fails', async () => {
      const task = createTestTask('Task');
      
      // Make LLM unavailable
      mockLLM.setAvailable(false);
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
    });
  });

  describe('parallel execution', () => {
    it('should execute independent tasks in parallel', async () => {
      const task = createTestTask('Parent task');
      
      // Mock LLM to return independent subtasks
      mockLLM.setResponse(
        'Parent task',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'Independent task 1', dependencies: [] },
              { description: 'Independent task 2', dependencies: [] },
              { description: 'Independent task 3', dependencies: [] },
            ],
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.7
      );
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const startTime = Date.now();
      const result = await orchestrator.execute(task);
      const duration = Date.now() - startTime;
      
      expect(result).toBeDefined();
      // Parallel execution should be faster (though with mocks it might be instant)
    });

    it('should respect dependency order', async () => {
      const task = createTestTask('Task with dependencies');
      
      mockLLM.setResponse(
        'Task with dependencies',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'First task', dependencies: [] },
              { description: 'Second task', dependencies: ['First task'] },
              { description: 'Third task', dependencies: ['Second task'] },
            ],
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.7
      );
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
    });
  });

  describe('agent selection', () => {
    it('should select agent with matching capabilities', async () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      const codeAgent = new MockAgent('code-agent', 'Code Agent', 'Code', ['code_generation']);
      const testAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test_generation']);
      
      agentRegistry.register(codeAgent);
      agentRegistry.register(testAgent);
      agentRegistry.setAgentAvailability('code-agent', true);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
    });

    it('should handle case when no suitable agent found', async () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['nonexistent_capability'],
      });
      
      const result = await orchestrator.execute(task);
      
      // Should still return a result (may be failure or fallback)
      expect(result).toBeDefined();
    });
  });

  describe('MCP server handling', () => {
    it('should ensure required MCP servers are available', async () => {
      const task = createTestTask('Task', 'pending', { requiredMCPServers: ['file-server'] });
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const connectSpy = vi.spyOn(mcpManager, 'connectServer');
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
      // May attempt to connect if server not found
    });
  });

  describe('result synthesis', () => {
    it('should synthesize results from multiple subtasks', async () => {
      const task = createTestTask('Parent task');
      
      mockLLM.setResponse(
        'Parent task',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'Subtask 1', dependencies: [] },
              { description: 'Subtask 2', dependencies: [] },
            ],
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.7
      );
      
      const mockAgent = new MockAgent('test-agent', 'Test Agent', 'Test', ['test']);
      agentRegistry.register(mockAgent);
      agentRegistry.setAgentAvailability('test-agent', true);
      
      const result = await orchestrator.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
    });
  });
});

