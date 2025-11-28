/**
 * TestAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestAgent } from './TestAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('TestAgent', () => {
  let agent: TestAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new TestAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('test-agent');
      expect(metadata.name).toBe('Test Agent');
      expect(metadata.capabilities).toContain('test_generation');
    });
  });

  describe('execute', () => {
    it('should execute test generation task', async () => {
      const task = createTestTask('Generate unit tests for a factorial function');
      
      mockLLM.setResponse(
        'Generate unit tests',
        {
          content: '```typescript\ndescribe("factorial", () => {\n  it("should return 1 for 0", () => {\n    expect(factorial(0)).toBe(1);\n  });\n});\n```',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should handle task with code context', async () => {
      const task = createTestTask('Generate tests', 'pending', {
        metadata: {
          codeContext: 'function add(a, b) { return a + b; }',
          testType: 'unit',
        },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockLLM.setAvailable(false);
      const task = createTestTask('Generate tests');
      
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with test_generation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks without required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(false);
    });
  });
});

