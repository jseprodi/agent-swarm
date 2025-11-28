/**
 * AgentFactory unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentFactory } from './AgentFactory.js';
import { AgentRegistry } from '../communication/AgentRegistry.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import type { AgentSpecification, AgentPersistenceOptions } from '../core/types.js';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('AgentFactory', () => {
  let factory: AgentFactory;
  let agentRegistry: AgentRegistry;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    agentRegistry = new AgentRegistry();
    mockLLM = new MockLLMProvider(true);
    factory = new AgentFactory(agentRegistry, mockLLM, 'test-data/agents');
    vi.clearAllMocks();
  });

  describe('createDynamicAgent', () => {
    it('should create a dynamic agent from specification', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const agent = await factory.createDynamicAgent(specification);

      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('Test Agent');
      expect(agentRegistry.getAgent(agent.id)).toBeDefined();
    });

    it('should generate unique agent IDs', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const agent1 = await factory.createDynamicAgent(specification);
      const agent2 = await factory.createDynamicAgent(specification);

      expect(agent1.id).not.toBe(agent2.id);
    });

    it('should persist agent when requested', async () => {
      const specification: AgentSpecification = {
        name: 'Persisted Agent',
        description: 'A persisted agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const persistenceOptions: AgentPersistenceOptions = {
        persist: true,
        persistConfig: true,
        persistCode: false,
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await factory.createDynamicAgent(specification, persistenceOptions);

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return existing agent if ID already exists', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const agent1 = await factory.createDynamicAgent(specification, undefined, 'custom-id');
      const agent2 = await factory.createDynamicAgent(specification, undefined, 'custom-id');

      expect(agent1).toBe(agent2);
    });
  });

  describe('generateAgentId', () => {
    it('should generate ID from agent name', () => {
      const specification: AgentSpecification = {
        name: 'My Test Agent',
        description: 'Test',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const id = factory.generateAgentId(specification);
      expect(id).toContain('my-test-agent');
      expect(id).toContain('dynamic-');
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const agent = await factory.createDynamicAgent(specification, undefined, 'test-id');
      const retrieved = factory.getAgent('test-id');

      expect(retrieved).toBe(agent);
    });

    it('should return undefined for non-existent agent', () => {
      const retrieved = factory.getAgent('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllCreatedAgents', () => {
    it('should return all created agents', async () => {
      const spec1: AgentSpecification = {
        name: 'Agent 1',
        description: 'First agent',
        capabilities: ['test'],
        behavior: { executionStrategy: 'llm_direct', outputFormat: 'json' },
        createdAt: new Date(),
      };
      const spec2: AgentSpecification = {
        name: 'Agent 2',
        description: 'Second agent',
        capabilities: ['test'],
        behavior: { executionStrategy: 'llm_direct', outputFormat: 'json' },
        createdAt: new Date(),
      };

      await factory.createDynamicAgent(spec1);
      await factory.createDynamicAgent(spec2);

      const allAgents = factory.getAllCreatedAgents();
      expect(allAgents.length).toBe(2);
    });
  });
});

