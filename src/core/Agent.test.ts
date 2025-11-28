/**
 * BaseAgent unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from './Agent.js';
import { MockLLMProvider, MockMCPServerClient } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';
import type { Task, TaskResult } from './types.js';

/**
 * Concrete implementation of BaseAgent for testing
 */
class TestAgent extends BaseAgent {
  constructor(llm?: any) {
    super('test-agent', 'Test Agent', 'Test agent for unit tests', ['test'], llm);
  }

  async execute(task: Task): Promise<TaskResult> {
    return this.createSuccessResult(task.id, { message: 'Test execution' });
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new TestAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize agent with provided parameters', () => {
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.description).toBe('Test agent for unit tests');
      expect(agent.capabilities).toEqual(['test']);
    });

    it('should use default CursorLLMProvider if no LLM provided', () => {
      const agentWithoutLLM = new TestAgent();
      expect(agentWithoutLLM).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should return agent metadata', () => {
      const metadata = agent.getMetadata();
      
      expect(metadata.id).toBe('test-agent');
      expect(metadata.name).toBe('Test Agent');
      expect(metadata.description).toBe('Test agent for unit tests');
      expect(metadata.capabilities).toEqual(['test']);
      expect(metadata.mcpServersUsed).toEqual([]);
    });

    it('should include MCP servers in metadata', () => {
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      
      const metadata = agent.getMetadata();
      expect(metadata.mcpServersUsed).toContain('file-server');
    });
  });

  describe('canHandle', () => {
    it('should return true for task with no requirements', () => {
      const task = createTestTask('Simple task');
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should return true when agent has all required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test'],
      });
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should return false when agent lacks required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      expect(agent.canHandle(task)).toBe(false);
    });

    it('should return false when agent lacks some required capabilities', () => {
      const multiCapAgent = new TestAgent(mockLLM);
      (multiCapAgent as any).capabilities = ['test', 'code'];
      
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['test', 'code', 'documentation'],
      });
      expect(multiCapAgent.canHandle(task)).toBe(false);
    });

    it('should return true when required MCP servers are available', () => {
      const task = createTestTask('Task', 'pending', { requiredMCPServers: ['file-server'] });
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should return false when required MCP servers are not available', () => {
      const task = createTestTask('Task', 'pending', { requiredMCPServers: ['file-server'] });
      expect(agent.canHandle(task)).toBe(false);
    });

    it('should return false when some required MCP servers are missing', () => {
      const task = createTestTask('Task', 'pending', { requiredMCPServers: ['file-server', 'git-server'] });
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      // git-server not added
      
      expect(agent.canHandle(task)).toBe(false);
    });
  });

  describe('MCP client management', () => {
    it('should add MCP client', () => {
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      
      const client = (agent as any).getMCPClient('file-server');
      expect(client).toBe(mockClient);
    });

    it('should remove MCP client', () => {
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      agent.removeMCPClient('file-server');
      
      const client = (agent as any).getMCPClient('file-server');
      expect(client).toBeUndefined();
    });

    it('should get MCP client by server ID', () => {
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      
      const client = (agent as any).getMCPClient('file-server');
      expect(client).toBe(mockClient);
    });

    it('should return undefined for non-existent MCP client', () => {
      const client = (agent as any).getMCPClient('non-existent');
      expect(client).toBeUndefined();
    });
  });

  describe('result creation helpers', () => {
    it('should create success result', () => {
      const result = (agent as any).createSuccessResult('task-id', { data: 'test' }, { meta: 'value' });
      
      expect(result.taskId).toBe('task-id');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'test' });
      expect(result.metadata).toEqual({ meta: 'value' });
      expect(result.mcpServersUsed).toEqual([]);
    });

    it('should create failure result', () => {
      const result = (agent as any).createFailureResult('task-id', 'Error message', { meta: 'value' });
      
      expect(result.taskId).toBe('task-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error message');
      expect(result.metadata).toEqual({ meta: 'value' });
      expect(result.mcpServersUsed).toEqual([]);
    });

    it('should include MCP servers in result', () => {
      const mockClient = new MockMCPServerClient(true);
      agent.addMCPClient('file-server', mockClient as any);
      
      const result = (agent as any).createSuccessResult('task-id');
      expect(result.mcpServersUsed).toContain('file-server');
    });
  });

  describe('getLLMHelpers', () => {
    it('should return LLM helpers for BaseLLMProvider', () => {
      const helpers = (agent as any).getLLMHelpers();
      // MockLLMProvider is not BaseLLMProvider, so should return null
      expect(helpers).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute task and return result', async () => {
      const task = createTestTask('Test task');
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
    });
  });

  describe('agent communication', () => {
    let messageQueue: any;
    
    beforeEach(() => {
      messageQueue = {
        sendDirectMessage: vi.fn(),
        requestResponse: vi.fn(),
        registerAgentHandler: vi.fn(),
        broadcast: vi.fn(),
      };
      (agent as any).messageQueue = messageQueue;
    });

    it('should send direct message to agent', () => {
      (agent as any).sendMessageToAgent('target-agent', 'agent_message', { data: 'test' });
      
      expect(messageQueue.sendDirectMessage).toHaveBeenCalledWith(
        'target-agent',
        expect.objectContaining({
          type: 'agent_message',
          sourceAgentId: 'test-agent',
        })
      );
    });

    it('should handle missing MessageQueue gracefully', () => {
      (agent as any).messageQueue = undefined;
      
      expect(() => {
        (agent as any).sendMessageToAgent('target-agent', 'agent_message', {});
      }).not.toThrow();
    });

    it('should request from agent', async () => {
      const mockResponse = { type: 'agent_response', payload: { result: 'ok' } };
      messageQueue.requestResponse.mockResolvedValue(mockResponse);
      
      const response = await (agent as any).requestFromAgent('target-agent', 'agent_request', {});
      
      expect(messageQueue.requestResponse).toHaveBeenCalled();
      expect(response).toBe(mockResponse);
    });

    it('should throw when requesting without MessageQueue', async () => {
      (agent as any).messageQueue = undefined;
      
      await expect(
        (agent as any).requestFromAgent('target-agent', 'agent_request', {})
      ).rejects.toThrow();
    });

    it('should subscribe to agent messages', () => {
      const handler = vi.fn();
      (agent as any).subscribeToAgentMessages('source-agent', 'agent_message', handler);
      
      expect(messageQueue.registerAgentHandler).toHaveBeenCalledWith(
        'source-agent',
        'agent_message',
        handler
      );
    });

    it('should respond to message', () => {
      const originalMessage = {
        id: 'msg-1',
        sourceAgentId: 'source-agent',
        correlationId: 'corr-1',
      };
      
      (agent as any).respondToMessage(originalMessage, 'agent_response', { result: 'ok' });
      
      expect(messageQueue.sendDirectMessage).toHaveBeenCalledWith(
        'source-agent',
        expect.objectContaining({
          type: 'agent_response',
          correlationId: 'corr-1',
        })
      );
    });

    it('should broadcast message', () => {
      (agent as any).broadcastMessage('broadcast_type', { data: 'test' });
      
      expect(messageQueue.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast_type',
          sourceAgentId: 'test-agent',
        })
      );
    });
  });
});

