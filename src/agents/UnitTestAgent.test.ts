/**
 * UnitTestAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UnitTestAgent } from './UnitTestAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('UnitTestAgent', () => {
  let agent: UnitTestAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new UnitTestAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('unit-test-agent');
      expect(metadata.name).toBe('Unit Test Agent');
      expect(metadata.capabilities).toContain('unit_test_generation');
      expect(metadata.capabilities).toContain('test_analysis');
      expect(metadata.capabilities).toContain('test_coverage');
    });
  });

  describe('execute', () => {
    it('should execute unit test generation task', async () => {
      const task = createTestTask('Generate unit tests for a factorial function');
      
      // Set default response with test code
      mockLLM.setDefaultResponse({
        content: '```javascript\ndescribe("factorial", () => {\n  it("should return 1 for 0", () => {\n    expect(factorial(0)).toBe(1);\n  });\n  it("should return 1 for 1", () => {\n    expect(factorial(1)).toBe(1);\n  });\n});\n```\n\nThese unit tests verify the factorial function works correctly for edge cases.',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.testCode).toBeDefined();
        expect(data.testFramework).toBeDefined();
        expect(data.testCount).toBeGreaterThan(0);
      }
    });

    it('should execute unit test generation with code context', async () => {
      const task = createTestTask('Generate unit tests', 'pending', {
        codeContext: 'function add(a, b) { return a + b; }',
        testFramework: 'jest',
      });
      
      // Set default response with test code
      mockLLM.setDefaultResponse({
        content: '```javascript\ndescribe("math", () => {\n  it("test 1", () => { expect(add(1, 2)).toBe(3); });\n  it("test 2", () => { expect(add(0, 0)).toBe(0); });\n});\n```',
        usage: { promptTokens: 8, completionTokens: 15, totalTokens: 23 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.testCode).toBeDefined();
        expect(data.testableUnits).toBeDefined();
      }
    });

    it('should detect test framework from generated code', async () => {
      const task = createTestTask('Generate unit tests for a function');
      
      // Set default response with pytest test
      mockLLM.setDefaultResponse({
        content: '```python\ndef test_factorial():\n    assert factorial(5) == 120\n```',
        usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.testFramework).toBe('pytest');
      }
    });

    it('should count unit tests correctly', async () => {
      const task = createTestTask('Generate multiple unit tests');
      
      // Set default response with multiple tests
      mockLLM.setDefaultResponse({
        content: '```javascript\ndescribe("math", () => {\n  it("test 1", () => {});\n  it("test 2", () => {});\n  it("test 3", () => {});\n});\n```',
        usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.testCount).toBe(3);
      }
    });

    it('should identify testable units from code context', async () => {
      const task = createTestTask('Generate unit tests', 'pending', {
        codeContext: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
      });
      
      mockLLM.setResponse(
        'Generate unit tests',
        {
          content: '```javascript\ntest("calculateTotal", () => {});\n```',
          usage: { promptTokens: 8, completionTokens: 12, totalTokens: 20 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.testableUnits).toBeDefined();
        const units = data.testableUnits as string[];
        expect(units.length).toBeGreaterThan(0);
      }
    });

    it('should handle errors gracefully', async () => {
      // Create a new mock LLM that's unavailable
      const unavailableLLM = new MockLLMProvider(false);
      // Ensure no default response can mask the error
      unavailableLLM.setDefaultResponse({
        content: '',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });
      const errorAgent = new UnitTestAgent(unavailableLLM);
      const task = createTestTask('Generate unit tests');
      
      const result = await errorAgent.execute(task);
      
      expect(result).toBeDefined();
      // The agent should handle the error and return a failure result 
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with unit_test_generation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['unit_test_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should handle tasks with test_analysis capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test_analysis'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should handle tasks with test_coverage capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test_coverage'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks without required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(false);
    });

    it('should handle tasks with multiple unit test capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['unit_test_generation', 'test_analysis'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });
  });
});

