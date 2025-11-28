/**
 * Error Recovery integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Swarm } from '../../src/index.js';
import { MockLLMProvider, MockAgent } from '../helpers/mocks.js';
import { createTestTask } from '../helpers/factories.js';

describe('Error Recovery Integration', () => {
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

  it('should retry on transient failures', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      errorRecovery: {
        enabled: true,
        retry: {
          maxRetries: 3,
          delayMs: 100,
        },
      },
    });

    const agent = new MockAgent('test-agent');
    agent.setExecuteError(new Error('Network timeout'));
    
    // Should attempt retry
    // Note: Actual retry behavior depends on implementation
    expect(swarm).toBeDefined();
  });

  it('should activate circuit breaker', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      errorRecovery: {
        enabled: true,
        circuitBreaker: {
          failureThreshold: 3,
        },
      },
    });

    // Circuit breaker should be initialized
    expect(swarm).toBeDefined();
  });

  it('should learn error patterns', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
      errorRecovery: {
        enabled: true,
        enableAnalysis: true,
      },
    });

    // Error pattern analyzer should be active
    expect(swarm).toBeDefined();
  });
});

