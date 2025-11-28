/**
 * Agent Factory - creates and manages dynamic agents
 */

import { DynamicAgent } from './DynamicAgent.js';
import { AgentPersistenceManager } from './persistence/AgentPersistenceManager.js';
import type {
  AgentSpecification,
  AgentPersistenceOptions,
  Agent,
} from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import { AgentRegistry } from '../communication/AgentRegistry.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class AgentFactory {
  private persistenceManager: AgentPersistenceManager;
  private agentRegistry: AgentRegistry;
  private llm: ILLMProvider;
  private createdAgents: Map<string, DynamicAgent> = new Map();

  constructor(
    agentRegistry: AgentRegistry,
    llm: ILLMProvider,
    persistenceDirectory?: string
  ) {
    this.agentRegistry = agentRegistry;
    this.llm = llm;
    this.persistenceManager = new AgentPersistenceManager(persistenceDirectory);
  }

  /**
   * Create a dynamic agent from a specification
   */
  async createDynamicAgent(
    specification: AgentSpecification,
    persistenceOptions?: AgentPersistenceOptions,
    customId?: string
  ): Promise<DynamicAgent> {
    // Generate unique agent ID
    const agentId = customId || this.generateAgentId(specification);

    // Check if agent with this ID already exists
    if (this.createdAgents.has(agentId)) {
      logger.warn(`Agent with ID ${agentId} already exists, returning existing agent`);
      return this.createdAgents.get(agentId)!;
    }

    // Create the agent
    const agent = new DynamicAgent(agentId, specification, this.llm);

    // Register in registry
    this.agentRegistry.register(agent);
    this.createdAgents.set(agentId, agent);

    // Handle persistence if requested
    const persistenceOpts: AgentPersistenceOptions = persistenceOptions || {
      persist: false,
      persistConfig: false,
      persistCode: false,
    };

    if (persistenceOpts.persist && persistenceOpts.persistConfig) {
      try {
        await this.persistenceManager.saveSpecification(
          agentId,
          specification,
          persistenceOpts
        );
      } catch (error) {
        logger.warn(`Failed to persist agent ${agentId}, continuing without persistence:`, error);
      }
    }

    logger.info(`Created dynamic agent: ${agent.name} (${agentId}) with capabilities: ${specification.capabilities.join(', ')}`);
    return agent;
  }

  /**
   * Load persisted agents from disk
   */
  async loadPersistedAgents(): Promise<DynamicAgent[]> {
    const loadedAgents: DynamicAgent[] = [];

    try {
      const persistedAgentIds = await this.persistenceManager.listPersistedAgents();

      for (const agentId of persistedAgentIds) {
        try {
          const specification = await this.persistenceManager.loadSpecification(agentId);
          
          if (!specification) {
            logger.warn(`Failed to load specification for agent ${agentId}`);
            continue;
          }

          // Create agent from specification
          const agent = await this.createDynamicAgent(
            specification,
            { persist: false, persistConfig: false, persistCode: false },
            agentId
          );

          loadedAgents.push(agent);
          logger.info(`Loaded persisted agent: ${agent.name} (${agentId})`);
        } catch (error) {
          logger.error(`Error loading persisted agent ${agentId}:`, error);
        }
      }

      logger.info(`Loaded ${loadedAgents.length} persisted agents`);
    } catch (error) {
      logger.error('Error loading persisted agents:', error);
    }

    return loadedAgents;
  }

  /**
   * Generate a unique agent ID from specification
   */
  generateAgentId(specification: AgentSpecification): string {
    // Create a base ID from the agent name
    const baseId = specification.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);

    // Add a short UUID to ensure uniqueness
    const uuid = uuidv4().substring(0, 8);
    return `dynamic-${baseId}-${uuid}`;
  }

  /**
   * Get a created agent by ID
   */
  getAgent(agentId: string): DynamicAgent | undefined {
    return this.createdAgents.get(agentId);
  }

  /**
   * Get all created agents
   */
  getAllCreatedAgents(): DynamicAgent[] {
    return Array.from(this.createdAgents.values());
  }

  /**
   * Delete a dynamic agent
   */
  async deleteAgent(agentId: string, deletePersisted: boolean = false): Promise<boolean> {
    const agent = this.createdAgents.get(agentId);
    if (!agent) {
      logger.warn(`Agent ${agentId} not found`);
      return false;
    }

    // Unregister from registry
    this.agentRegistry.unregister(agentId);

    // Remove from created agents map
    this.createdAgents.delete(agentId);

    // Delete persisted specification if requested
    if (deletePersisted) {
      await this.persistenceManager.deletePersistedAgent(agentId);
    }

    logger.info(`Deleted dynamic agent: ${agentId}`);
    return true;
  }

  /**
   * Get the persistence manager
   */
  getPersistenceManager(): AgentPersistenceManager {
    return this.persistenceManager;
  }
}

