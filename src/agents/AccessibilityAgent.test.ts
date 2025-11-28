/**
 * AccessibilityAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccessibilityAgent } from './AccessibilityAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('AccessibilityAgent', () => {
  let agent: AccessibilityAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new AccessibilityAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('accessibility-agent');
      expect(metadata.name).toBe('Accessibility Agent');
      expect(metadata.capabilities).toContain('accessibility_testing');
    });
  });

  describe('execute', () => {
    it('should execute accessibility testing task', async () => {
      const task = createTestTask('Test accessibility of HTML page', 'pending', {
        metadata: {
          htmlContent: '<div>Test</div>',
          wcagLevel: 'AA',
        },
      });
      
      mockLLM.setResponse(
        'Test accessibility',
        {
          content: 'Accessibility issues found:...',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should execute accessibility implementation task', async () => {
      const task = createTestTask('Implement ARIA labels for buttons');
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockLLM.setAvailable(false);
      const task = createTestTask('Test accessibility');
      
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with accessibility_testing capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['accessibility_testing'],
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

