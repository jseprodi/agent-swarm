/**
 * DocumentationAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentationAgent } from './DocumentationAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('DocumentationAgent', () => {
  let agent: DocumentationAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new DocumentationAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('documentation-agent');
      expect(metadata.name).toBe('Documentation Agent');
      expect(metadata.capabilities).toContain('documentation');
    });
  });

  describe('execute', () => {
    it('should execute README generation task', async () => {
      const task = createTestTask('Generate a README file for the project');
      
      mockLLM.setResponse(
        'Generate a README',
        {
          content: '# Project Name\n\nDescription of the project.',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should handle API documentation generation', async () => {
      const task = createTestTask('Generate API documentation');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle code comments generation', async () => {
      const task = createTestTask('Generate inline code comments', 'pending', {
        metadata: {
          codeContext: 'function calculate() { return 1 + 1; }',
        },
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
      const errorAgent = new DocumentationAgent(unavailableLLM);
      const task = createTestTask('Generate documentation');
      
      const result = await errorAgent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with documentation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['documentation'],
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

