/**
 * CodeAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeAgent } from './CodeAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('CodeAgent', () => {
  let agent: CodeAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new CodeAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('code-agent');
      expect(metadata.name).toBe('Code Agent');
      expect(metadata.capabilities).toContain('code_generation');
    });
  });

  describe('execute', () => {
    it('should execute code generation task', async () => {
      const task = createTestTask('Generate a factorial function');
      
      mockLLM.setResponse(
        'Generate a factorial function',
        {
          content: 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
    });

    it('should handle task with code modification', async () => {
      const task = createTestTask('Modify existing function to add error handling');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with code_generation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks without required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(false);
    });
  });
});

