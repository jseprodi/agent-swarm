/**
 * Agent Communication integration tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Swarm } from '../../src/index.js';
import { MockLLMProvider } from '../helpers/mocks.js';
import { createTestTask } from '../helpers/factories.js';

describe('Agent Communication Integration', () => {
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

  it('should support direct agent-to-agent messaging', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
    });

    const messageQueue = swarm.getMessageQueue();
    expect(messageQueue).toBeDefined();
    
    // MessageQueue should support direct messaging
    expect(typeof messageQueue.sendDirectMessage).toBe('function');
  });

  it('should support request/response patterns', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
    });

    const messageQueue = swarm.getMessageQueue();
    expect(typeof messageQueue.requestResponse).toBe('function');
  });

  it('should support broadcast messaging', async () => {
    swarm = new Swarm({
      llmProvider: mockLLM,
    });

    const messageQueue = swarm.getMessageQueue();
    expect(typeof messageQueue.broadcast).toBe('function');
  });
});

