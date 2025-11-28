/**
 * Agent Persistence Manager - handles saving and loading agent specifications
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentSpecification, AgentPersistenceOptions } from '../../core/types.js';
import logger from '../../utils/logger.js';

export class AgentPersistenceManager {
  private persistenceDirectory: string;

  constructor(persistenceDirectory: string = 'data/agents/dynamic') {
    this.persistenceDirectory = persistenceDirectory;
  }

  /**
   * Save agent specification to disk
   */
  async saveSpecification(
    agentId: string,
    specification: AgentSpecification,
    options: AgentPersistenceOptions
  ): Promise<void> {
    if (!options.persist || !options.persistConfig) {
      logger.debug(`Skipping persistence for agent ${agentId} (persistConfig: ${options.persistConfig})`);
      return;
    }

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists();

      // Create specification with metadata
      const specWithMetadata: AgentSpecification & { agentId: string; savedAt: Date } = {
        ...specification,
        agentId,
        savedAt: new Date(),
        createdAt: specification.createdAt || new Date(),
        updatedAt: new Date(),
      };

      // Save as JSON file
      const filePath = this.getSpecificationFilePath(agentId);
      await fs.writeFile(
        filePath,
        JSON.stringify(specWithMetadata, null, 2),
        'utf-8'
      );

      logger.info(`Saved agent specification for ${agentId} to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save agent specification for ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Load agent specification from disk
   */
  async loadSpecification(agentId: string): Promise<AgentSpecification | null> {
    try {
      const filePath = this.getSpecificationFilePath(agentId);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        logger.debug(`No persisted specification found for agent ${agentId}`);
        return null;
      }

      // Read and parse JSON
      const content = await fs.readFile(filePath, 'utf-8');
      const spec = JSON.parse(content);

      // Remove metadata fields that aren't part of AgentSpecification
      const { agentId: _, savedAt: __, ...specification } = spec;

      logger.info(`Loaded agent specification for ${agentId} from ${filePath}`);
      return specification as AgentSpecification;
    } catch (error) {
      logger.error(`Failed to load agent specification for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * List all persisted agent IDs
   */
  async listPersistedAgents(): Promise<string[]> {
    try {
      await this.ensureDirectoryExists();
      
      const files = await fs.readdir(this.persistenceDirectory);
      const agentIds = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));

      logger.debug(`Found ${agentIds.length} persisted agents`);
      return agentIds;
    } catch (error) {
      logger.warn(`Failed to list persisted agents:`, error);
      return [];
    }
  }

  /**
   * Delete persisted agent specification
   */
  async deletePersistedAgent(agentId: string): Promise<boolean> {
    try {
      const filePath = this.getSpecificationFilePath(agentId);
      
      try {
        await fs.access(filePath);
      } catch {
        logger.debug(`No persisted specification found for agent ${agentId} to delete`);
        return false;
      }

      await fs.unlink(filePath);
      logger.info(`Deleted persisted agent specification for ${agentId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete persisted agent specification for ${agentId}:`, error);
      return false;
    }
  }

  /**
   * Get the file path for an agent specification
   */
  private getSpecificationFilePath(agentId: string): string {
    // Sanitize agent ID for filename
    const sanitizedId = agentId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.persistenceDirectory, `${sanitizedId}.json`);
  }

  /**
   * Ensure the persistence directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.persistenceDirectory);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.persistenceDirectory, { recursive: true });
      logger.debug(`Created persistence directory: ${this.persistenceDirectory}`);
    }
  }

  /**
   * Get the persistence directory path
   */
  getPersistenceDirectory(): string {
    return this.persistenceDirectory;
  }

  /**
   * Set a new persistence directory
   */
  setPersistenceDirectory(directory: string): void {
    this.persistenceDirectory = directory;
  }
}

