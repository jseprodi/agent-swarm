/**
 * AgentRegistry unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from './AgentRegistry.js';
import { MockAgent } from '../../__tests__/helpers/mocks.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let agent1: MockAgent;
  let agent2: MockAgent;

  beforeEach(() => {
    registry = new AgentRegistry();
    agent1 = new MockAgent('agent-1', 'Agent 1', 'First agent', ['code_generation']);
    agent2 = new MockAgent('agent-2', 'Agent 2', 'Second agent', ['test_generation', 'code_generation']);
  });

  describe('register', () => {
    it('should register an agent', () => {
      registry.register(agent1);
      
      const retrieved = registry.getAgent('agent-1');
      expect(retrieved).toBe(agent1);
    });

    it('should register multiple agents', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(2);
    });

    it('should overwrite existing agent with same ID', () => {
      registry.register(agent1);
      
      const newAgent = new MockAgent('agent-1', 'New Agent', 'New', ['new_capability']);
      registry.register(newAgent);
      
      const retrieved = registry.getAgent('agent-1');
      expect(retrieved).toBe(newAgent);
      expect(registry.getAllAgents()).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('should unregister an agent', () => {
      registry.register(agent1);
      registry.unregister('agent-1');
      
      const retrieved = registry.getAgent('agent-1');
      expect(retrieved).toBeUndefined();
    });

    it('should not throw when unregistering non-existent agent', () => {
      expect(() => {
        registry.unregister('non-existent');
      }).not.toThrow();
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', () => {
      registry.register(agent1);
      
      const retrieved = registry.getAgent('agent-1');
      expect(retrieved).toBe(agent1);
    });

    it('should return undefined for non-existent agent', () => {
      const retrieved = registry.getAgent('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(2);
      expect(allAgents).toContain(agent1);
      expect(allAgents).toContain(agent2);
    });

    it('should return empty array when no agents registered', () => {
      const allAgents = registry.getAllAgents();
      expect(allAgents).toHaveLength(0);
    });
  });

  describe('getAgentMetadata', () => {
    it('should return agent metadata', () => {
      registry.register(agent1);
      
      const metadata = registry.getAgentMetadata('agent-1');
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('agent-1');
      expect(metadata?.name).toBe('Agent 1');
      expect(metadata?.capabilities).toEqual(['code_generation']);
    });

    it('should return undefined for non-existent agent', () => {
      const metadata = registry.getAgentMetadata('non-existent');
      expect(metadata).toBeUndefined();
    });
  });

  describe('findAgentsByCapability', () => {
    it('should find agents with all required capabilities', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const agents = registry.findAgentsByCapability(['code_generation']);
      expect(agents).toHaveLength(2);
      expect(agents).toContain(agent1);
      expect(agents).toContain(agent2);
    });

    it('should find agents with multiple required capabilities', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const agents = registry.findAgentsByCapability(['test_generation', 'code_generation']);
      expect(agents).toHaveLength(1);
      expect(agents).toContain(agent2);
    });

    it('should return empty array when no agents match', () => {
      registry.register(agent1);
      
      const agents = registry.findAgentsByCapability(['nonexistent_capability']);
      expect(agents).toHaveLength(0);
    });
  });

  describe('findAgentsWithAnyCapability', () => {
    it('should find agents with any of the capabilities', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const agents = registry.findAgentsWithAnyCapability(['test_generation', 'code_generation']);
      expect(agents).toHaveLength(2);
    });

    it('should return empty array when no agents match', () => {
      registry.register(agent1);
      
      const agents = registry.findAgentsWithAnyCapability(['nonexistent_capability']);
      expect(agents).toHaveLength(0);
    });
  });

  describe('getAvailableAgents', () => {
    it('should return all agents when all are available', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const available = registry.getAvailableAgents();
      expect(available).toHaveLength(2);
    });

    it('should exclude unavailable agents', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      registry.setAgentAvailability('agent-1', false);
      
      const available = registry.getAvailableAgents();
      expect(available).toHaveLength(1);
      expect(available).toContain(agent2);
    });
  });

  describe('setAgentAvailability', () => {
    it('should set agent availability', () => {
      registry.register(agent1);
      
      registry.setAgentAvailability('agent-1', false);
      
      const available = registry.getAvailableAgents();
      expect(available).not.toContain(agent1);
    });

    it('should not throw when setting availability for non-existent agent', () => {
      expect(() => {
        registry.setAgentAvailability('non-existent', false);
      }).not.toThrow();
    });
  });

  describe('updateAgentMCPServers', () => {
    it('should update MCP servers for agent', () => {
      registry.register(agent1);
      
      registry.updateAgentMCPServers('agent-1', ['file-server', 'git-server']);
      
      const metadata = registry.getAgentMetadata('agent-1');
      // MCP servers are stored in registration, not directly in metadata
      // But we can check registration
      const registrations = registry.getAllRegistrations();
      const registration = registrations.find(r => r.agentId === 'agent-1');
      expect(registration?.mcpServersUsed).toEqual(['file-server', 'git-server']);
    });

    it('should not throw when updating MCP servers for non-existent agent', () => {
      expect(() => {
        registry.updateAgentMCPServers('non-existent', ['file-server']);
      }).not.toThrow();
    });
  });

  describe('getAllRegistrations', () => {
    it('should return all registrations', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      const registrations = registry.getAllRegistrations();
      expect(registrations).toHaveLength(2);
      expect(registrations.map(r => r.agentId)).toContain('agent-1');
      expect(registrations.map(r => r.agentId)).toContain('agent-2');
    });
  });

  describe('clear', () => {
    it('should clear all agents and registrations', () => {
      registry.register(agent1);
      registry.register(agent2);
      
      registry.clear();
      
      expect(registry.getAllAgents()).toHaveLength(0);
      expect(registry.getAllRegistrations()).toHaveLength(0);
    });
  });
});

