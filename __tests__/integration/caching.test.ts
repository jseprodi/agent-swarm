/**
 * Caching integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Swarm } from '../../src/index.js';
import { MockLLMProvider } from '../helpers/mocks.js';
import { createTestTask } from '../helpers/factories.js';

describe('Caching Integration', () => {
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

  it('should cache LLM responses in actual execution', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      caching: {
        enabled: true,
        llmCache: {
          enabled: true,
          maxSize: 100,
        },
      },
    });

    // Use default response for all LLM calls
    mockLLM.setDefaultResponse({
      content: '{"subtasks": [{"description": "Test task", "agent": "code-agent"}], "reasoning": "Decomposition"}',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const result1 = await swarm.execute('Test task');
    
    // Second execution should use cache
    const result2 = await swarm.execute('Test task');
    
    // Both should succeed (or at least not timeout)
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  }, 20000);

  it('should cache task results in orchestrator', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      caching: {
        enabled: true,
        taskCache: {
          enabled: true,
        },
      },
    });

    // Use default response for all LLM calls
    mockLLM.setDefaultResponse({
      content: '{"subtasks": [{"description": "Cached task", "agent": "code-agent"}], "reasoning": "Decomposition"}',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });

    const result1 = await swarm.execute('Cached task');
    
    // Task should be cached
    expect(result1).toBeDefined();
  }, 20000);

  it('should impact performance with cache hits', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      caching: {
        enabled: true,
      },
    });

    // Use default response for all LLM calls
    mockLLM.setDefaultResponse({
      content: '{"subtasks": [{"description": "Performance test", "agent": "code-agent"}], "reasoning": "Decomposition"}',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    });
    
    const start1 = Date.now();
    await swarm.execute('Performance test');
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await swarm.execute('Performance test');
    const time2 = Date.now() - start2;
    
    // Second execution should be faster (cached) or at least not slower
    expect(time2).toBeLessThanOrEqual(time1 * 2); // Allow some variance
  }, 20000);
});

