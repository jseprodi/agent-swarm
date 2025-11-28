/**
 * ErrorDebuggingAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorDebuggingAgent } from './ErrorDebuggingAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('ErrorDebuggingAgent', () => {
  let agent: ErrorDebuggingAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new ErrorDebuggingAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('error-debugging-agent');
      expect(metadata.name).toBe('Error Debugging Agent');
      expect(metadata.capabilities).toContain('error_debugging');
    });
  });

  describe('execute', () => {
    it('should execute console error debugging task', async () => {
      const task = createTestTask('Debug console error: ReferenceError', 'pending', {
        metadata: {
          errorMessage: 'ReferenceError: x is not defined',
          stackTrace: 'at line 10',
        },
      });
      
      mockLLM.setResponse(
        'Debug console error',
        {
          content: 'The error is caused by...',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should execute network error debugging task', async () => {
      const task = createTestTask('Debug network error: 404 Not Found');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should execute error prevention task', async () => {
      const task = createTestTask('Scan code for potential errors', 'pending', {
        metadata: {
          codeContent: 'function test() { return x; }',
        },
      });
      
      // Set default response for error prevention
      mockLLM.setDefaultResponse({
        content: 'Potential errors found: 1. Null pointer risk...',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Create a new mock LLM that's unavailable
      const unavailableLLM = new MockLLMProvider(false);
      // Ensure no default response can mask the error
      unavailableLLM.setDefaultResponse({
        content: '',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      });
      const errorAgent = new ErrorDebuggingAgent(unavailableLLM);
      const task = createTestTask('Debug error');
      
      const result = await errorAgent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with error_debugging capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['error_debugging'],
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

