/**
 * StylesheetAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StylesheetAgent } from './StylesheetAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('StylesheetAgent', () => {
  let agent: StylesheetAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new StylesheetAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('stylesheet-agent');
      expect(metadata.name).toBe('Stylesheet Agent');
      expect(metadata.capabilities).toContain('stylesheet_generation');
    });
  });

  describe('execute', () => {
    it('should execute stylesheet generation task', async () => {
      const task = createTestTask('Generate a CSS stylesheet for a landing page');
      
      mockLLM.setResponse(
        'Generate a CSS',
        {
          content: '```css\n.container { display: flex; }\n```',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should handle stylesheet analysis task', async () => {
      const task = createTestTask('Analyze CSS for conflicts');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle stylesheet optimization task', async () => {
      const task = createTestTask('Optimize CSS file');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockLLM.setAvailable(false);
      const task = createTestTask('Generate stylesheet');
      
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with stylesheet_generation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['stylesheet_generation'],
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

