/**
 * Registry for managing agents and their capabilities
 */

import type { Agent, AgentMetadata, AgentCapability } from '../core/types.js';
import type { AgentRegistration } from './types.js';
import logger from '../utils/logger.js';

export class AgentRegistry {
  private agents: Map<string, Agent> = new Map();
  private registrations: Map<string, AgentRegistration> = new Map();

  /**
   * Register an agent
   */
  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
    
    const registration: AgentRegistration = {
      agentId: agent.id,
      capabilities: agent.capabilities,
      mcpServersUsed: [],
      isAvailable: true,
    };
    
    this.registrations.set(agent.id, registration);
    
    logger.info(`Registered agent: ${agent.name} (${agent.id}) with capabilities: ${agent.capabilities.join(', ')}`);
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
    this.registrations.delete(agentId);
    logger.info(`Unregistered agent: ${agentId}`);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent metadata
   */
  getAgentMetadata(agentId: string): AgentMetadata | undefined {
    const agent = this.agents.get(agentId);
    if (!agent) return undefined;

    const registration = this.registrations.get(agentId);
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      mcpServersUsed: registration?.mcpServersUsed || [],
    };
  }

  /**
   * Find agents by capability
   */
  findAgentsByCapability(capabilities: AgentCapability[]): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      capabilities.every(capability => agent.capabilities.includes(capability))
    );
  }

  /**
   * Find agents that can handle specific capabilities (any match)
   */
  findAgentsWithAnyCapability(capabilities: AgentCapability[]): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      capabilities.some(capability => agent.capabilities.includes(capability))
    );
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      const registration = this.registrations.get(agent.id);
      return registration?.isAvailable !== false;
    });
  }

  /**
   * Mark agent as busy/unavailable
   */
  setAgentAvailability(agentId: string, isAvailable: boolean): void {
    const registration = this.registrations.get(agentId);
    if (registration) {
      registration.isAvailable = isAvailable;
      logger.debug(`Agent ${agentId} availability set to: ${isAvailable}`);
    }
  }

  /**
   * Update MCP servers used by an agent
   */
  updateAgentMCPServers(agentId: string, mcpServers: string[]): void {
    const registration = this.registrations.get(agentId);
    if (registration) {
      registration.mcpServersUsed = mcpServers;
      logger.debug(`Updated MCP servers for agent ${agentId}: ${mcpServers.join(', ')}`);
    }
  }

  /**
   * Get all registrations
   */
  getAllRegistrations(): AgentRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.agents.clear();
    this.registrations.clear();
    logger.info('Agent registry cleared');
  }
}

