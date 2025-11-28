/**
 * DynamicAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicAgent } from './DynamicAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';
import type { AgentSpecification } from '../core/types.js';

describe('DynamicAgent', () => {
  let agent: DynamicAgent;
  let mockLLM: MockLLMProvider;
  let specification: AgentSpecification;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    specification = {
      name: 'Test Dynamic Agent',
      description: 'A test dynamic agent',
      capabilities: ['test_capability'],
      behavior: {
        executionStrategy: 'llm_direct',
        outputFormat: 'json',
        temperature: 0.7,
      },
      createdAt: new Date(),
    };
    agent = new DynamicAgent('test-dynamic-agent', specification, mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('test-dynamic-agent');
      expect(metadata.name).toBe('Test Dynamic Agent');
      expect(metadata.capabilities).toEqual(['test_capability']);
    });

    it('should store specification', () => {
      const spec = agent.getSpecification();
      expect(spec.name).toBe('Test Dynamic Agent');
      expect(spec.capabilities).toEqual(['test_capability']);
    });
  });

  describe('execute', () => {
    it('should execute task with llm_direct strategy', async () => {
      const task = createTestTask('Test task');
      
      mockLLM.setResponse(
        'Test task',
        {
          content: '{"result": "success"}',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });

    it('should execute task with workflow strategy', async () => {
      const workflowSpec: AgentSpecification = {
        ...specification,
        behavior: {
          executionStrategy: 'workflow',
          workflowSteps: [
            { step: 'step1', description: 'First step', action: 'Do something' },
            { step: 'step2', description: 'Second step', action: 'Do something else' },
          ],
          outputFormat: 'json',
        },
      };
      const workflowAgent = new DynamicAgent('workflow-agent', workflowSpec, mockLLM);
      
      const task = createTestTask('Workflow task');
      const result = await workflowAgent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockLLM.setAvailable(false);
      const task = createTestTask('Test task');
      
      const result = await agent.execute(task);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('updateSpecification', () => {
    it('should update specification', () => {
      const updatedSpec: Partial<AgentSpecification> = {
        description: 'Updated description',
      };
      
      agent.updateSpecification(updatedSpec);
      
      const spec = agent.getSpecification();
      expect(spec.description).toBe('Updated description');
      expect(spec.updatedAt).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with matching capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test_capability'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks without matching capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['other_capability'],
      });
      
      expect(agent.canHandle(task)).toBe(false);
    });
  });
});

