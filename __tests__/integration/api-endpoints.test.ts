/**
 * Integration tests for API endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Swarm } from '../../src/index.js';
import { MockLLMProvider } from '../helpers/mocks.js';

// Note: This is a simplified integration test
// Full API server integration would require starting the actual server
describe('API Endpoints Integration', () => {
  let swarm: Swarm;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    swarm = new Swarm({
      llmProvider: mockLLM,
      enableHealthChecks: false,
    });
  });

  afterEach(async () => {
    await swarm.cleanup();
  });

  describe('Task Creation', () => {
    it('should create task via Swarm API', async () => {
      mockLLM.setResponse(
        'break it down',
        {
          content: JSON.stringify({
            subtasks: [{ description: 'Test subtask', agent: 'code-agent' }],
            reasoning: 'Test decomposition',
          }),
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        }
      );

      mockLLM.setResponse('select', {
        content: '["code-agent"]',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      mockLLM.setResponse('Test subtask', {
        content: 'Test result',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });

      const result = await swarm.execute('Test task description');

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });

  describe('Agent Querying', () => {
    it('should retrieve agent information', () => {
      const registry = swarm.getAgentRegistry();
      const agents = registry.getAllAgents();

      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      const codeAgent = registry.getAgent('code-agent');
      expect(codeAgent).toBeDefined();
      expect(codeAgent?.getMetadata().name).toBe('Code Agent');
    });

    it('should query agents by capabilities', () => {
      const registry = swarm.getAgentRegistry();
      const agents = registry.findAgents(['code_generation']);

      expect(agents.length).toBeGreaterThan(0);
      expect(agents.every(a => a.capabilities.includes('code_generation'))).toBe(true);
    });
  });

  describe('MCP Server Management', () => {
    it('should manage MCP servers', () => {
      const mcpManager = swarm.getMCPManager();
      const registry = mcpManager.getRegistry();
      const servers = registry.getAllServers();

      expect(Array.isArray(servers)).toBe(true);
    });

    it('should find servers by capability', () => {
      const mcpManager = swarm.getMCPManager();
      const servers = mcpManager.findServersByCapability(['file_operations']);

      expect(Array.isArray(servers)).toBe(true);
    });
  });
});

