/**
 * Integration tests for agent interactions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Swarm } from '../../src/index.js';
import { MockLLMProvider } from '../helpers/mocks.js';
import { createTestTask } from '../helpers/factories.js';

describe('Agent Interactions Integration', () => {
  let swarm: Swarm;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    swarm = new Swarm({
      llmProvider: mockLLM,
      enableHealthChecks: false,
    });
  });

  afterEach(async () => {
    await swarm.cleanup();
  });

  describe('Multi-Agent Task Execution', () => {
    it('should coordinate multiple agents for complex task', async () => {
      // Mock LLM responses for task decomposition
      mockLLM.setResponse(
        'break it down',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'Generate code', agent: 'code-agent' },
              { description: 'Generate tests', agent: 'test-agent' },
              { description: 'Generate documentation', agent: 'documentation-agent' },
            ],
            reasoning: 'Breaking down into code, tests, and docs',
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );

      mockLLM.setResponse(
        'select',
        {
          content: '["code-agent", "test-agent", "documentation-agent"]',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );

      // Mock agent responses
      mockLLM.setResponse('Generate code', {
        content: 'function test() { return true; }',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      mockLLM.setResponse('Generate tests', {
        content: 'describe("test", () => { it("works", () => { expect(true).toBe(true); }); });',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      mockLLM.setResponse('Generate documentation', {
        content: '# Test\n\nThis is a test function.',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      const result = await swarm.execute(
        'Create a complete utility library with code, tests, and documentation'
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle agent failures gracefully', async () => {
      mockLLM.setResponse(
        'break it down',
        {
          content: JSON.stringify({
            subtasks: [{ description: 'Generate code', agent: 'code-agent' }],
            reasoning: 'Single subtask',
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );

      mockLLM.setResponse('select', {
        content: '["code-agent"]',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      // Simulate agent failure
      mockLLM.setAvailable(false);

      const result = await swarm.execute('Generate code');

      // Should handle failure gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Agent Registry Integration', () => {
    it('should register and retrieve agents', () => {
      const registry = swarm.getAgentRegistry();
      const agents = registry.getAllAgents();

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.id === 'code-agent')).toBe(true);
      expect(agents.some(a => a.id === 'test-agent')).toBe(true);
    });

    it('should find agents by capabilities', () => {
      const registry = swarm.getAgentRegistry();
      const agents = registry.findAgents(['code_generation']);

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.capabilities.includes('code_generation'))).toBe(true);
    });
  });

  describe('Task Manager Integration', () => {
    it('should track task lifecycle', async () => {
      const taskManager = swarm.getTaskManager();
      const task = taskManager.createTask('Test task');

      expect(task.status).toBe('pending');
      expect(taskManager.getTask(task.id)).toBeDefined();

      taskManager.updateTaskStatus(task.id, 'in_progress');
      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('in_progress');
    });

    it('should handle task dependencies', () => {
      const taskManager = swarm.getTaskManager();
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');

      taskManager.addDependency(task2.id, task1.id);
      const dependencies = taskManager.getDependencies(task2.id);

      expect(dependencies).toContain(task1.id);
    });
  });
});

