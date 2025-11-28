/**
 * BaseLLMProvider unit tests
 */

import { describe, it, expect, vi } from 'vitest';
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import type { LLMResponse } from './types.js';

/**
 * Concrete implementation for testing
 */
class TestLLMProvider extends BaseLLMProvider {
  async requestCompletion(request: any): Promise<LLMResponse> {
    return {
      content: 'Test response',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };
  }

  isAvailable(): boolean {
    return true;
  }

  getName(): string {
    return 'Test';
  }
}

describe('BaseLLMProvider', () => {
  let provider: TestLLMProvider;

  beforeEach(() => {
    provider = new TestLLMProvider();
  });

  describe('decomposeTask', () => {
    it('should decompose task with valid JSON response', async () => {
      const mockProvider = new MockLLMProvider(true);
      mockProvider.setResponse(
        'Given the following task',
        {
          content: JSON.stringify({
            subtasks: [
              { description: 'Subtask 1', agent: 'code-agent', dependencies: [] },
            ],
            reasoning: 'Test reasoning',
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.3
      );

      // Create a test provider that uses the mock
      class TestProviderWithMock extends BaseLLMProvider {
        async requestCompletion(request: any): Promise<LLMResponse> {
          return mockProvider.requestCompletion(request);
        }
        isAvailable() { return true; }
        getName() { return 'Test'; }
      }

      const testProvider = new TestProviderWithMock();
      const result = await testProvider.decomposeTask('Test task', ['code-agent']);
      
      expect(result.subtasks).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should fallback when JSON parsing fails', async () => {
      const mockProvider = new MockLLMProvider(true);
      mockProvider.setResponse(
        'Given the following task',
        {
          content: 'Invalid JSON response',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.3
      );

      class TestProviderWithMock extends BaseLLMProvider {
        async requestCompletion(request: any): Promise<LLMResponse> {
          return mockProvider.requestCompletion(request);
        }
        isAvailable() { return true; }
        getName() { return 'Test'; }
      }

      const testProvider = new TestProviderWithMock();
      const result = await testProvider.decomposeTask('Test task', ['code-agent']);
      
      expect(result.subtasks).toBeDefined();
      expect(result.subtasks.length).toBeGreaterThan(0);
    });
  });

  describe('selectAgents', () => {
    it('should select agents from available list', async () => {
      const mockProvider = new MockLLMProvider(true);
      mockProvider.setResponse(
        'Given the following task',
        {
          content: JSON.stringify(['code-agent', 'test-agent']),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
        0.7
      );

      class TestProviderWithMock extends BaseLLMProvider {
        async requestCompletion(request: any): Promise<LLMResponse> {
          return mockProvider.requestCompletion(request);
        }
        isAvailable() { return true; }
        getName() { return 'Test'; }
      }

      const testProvider = new TestProviderWithMock();
      const agents = [
        { id: 'code-agent', capabilities: ['code'], description: 'Code agent' },
        { id: 'test-agent', capabilities: ['test'], description: 'Test agent' },
      ];
      
      const result = await testProvider.selectAgents('Test task', agents);
      expect(result).toBeDefined();
    });
  });
});

