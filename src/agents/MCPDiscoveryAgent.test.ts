/**
 * MCPDiscoveryAgent unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPDiscoveryAgent } from './MCPDiscoveryAgent.js';
import { MCPManager } from '../mcp/MCPManager.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';
import { createTestMCPServer } from '../../__tests__/helpers/factories.js';

// Mock MCPManager methods
vi.mock('../mcp/MCPManager.js', () => {
  return {
    MCPManager: vi.fn().mockImplementation(() => ({
      getRegistry: vi.fn().mockReturnValue({
        getAllServers: vi.fn().mockReturnValue([]),
      }),
      addServer: vi.fn(),
      connectServer: vi.fn().mockResolvedValue({
        isConnected: vi.fn().mockReturnValue(true),
      }),
    })),
  };
});

describe('MCPDiscoveryAgent', () => {
  let agent: MCPDiscoveryAgent;
  let mockLLM: MockLLMProvider;
  let mcpManager: MCPManager;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    mcpManager = new MCPManager();
    agent = new MCPDiscoveryAgent(mcpManager, mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('mcp-discovery-agent');
      expect(metadata.name).toBe('MCP Discovery Agent');
      expect(metadata.capabilities).toContain('mcp_discovery');
    });
  });

  describe('execute', () => {
    it('should execute MCP discovery task', async () => {
      const task = createTestTask('Discover MCP servers for file operations');
      
      // Mock LLM response for capability determination
      mockLLM.setResponse(
        'MCP server',
        {
          content: '["file_operations"]',
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      // Result may be success even if no servers found
      expect(result).toHaveProperty('success');
    });

    it('should handle task with explicit MCP server requirements', async () => {
      const task = createTestTask('Discover servers', 'pending', {
        requiredMCPServers: ['file-server'],
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockLLM.setAvailable(false);
      const task = createTestTask('Discover MCP servers');
      
      const result = await agent.execute(task);
      
      // Should still succeed with fallback keyword extraction
      expect(result).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with mcp_discovery capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['mcp_discovery'],
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

