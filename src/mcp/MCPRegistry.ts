/**
 * Registry for managing discovered and connected MCP servers
 */

import type { 
  MCPServerMetadata,
  MCPServerCapability,
  MCPServerSearchCriteria 
} from './types.js';
import { MCPServerClient } from './MCPServerClient.js';
import logger from '../utils/logger.js';

export class MCPRegistry {
  private servers: Map<string, MCPServerMetadata> = new Map();
  private clients: Map<string, MCPServerClient> = new Map();

  register(metadata: MCPServerMetadata): void {
    this.servers.set(metadata.id, metadata);
    logger.info(`Registered MCP server: ${metadata.name} (${metadata.id})`);
  }

  async connect(serverId: string): Promise<MCPServerClient> {
    const metadata = this.servers.get(serverId);
    if (!metadata) {
      throw new Error(`MCP server ${serverId} not found in registry`);
    }

    let client = this.clients.get(serverId);
    if (!client) {
      client = new MCPServerClient(metadata);
      this.clients.set(serverId, client);
    }

    if (!client.isConnected()) {
      await client.connect();
      // Update metadata with latest connection info
      const updatedMetadata = client.getMetadata();
      this.servers.set(serverId, updatedMetadata);
    }

    return client;
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }
  }

  getClient(serverId: string): MCPServerClient | undefined {
    return this.clients.get(serverId);
  }

  getMetadata(serverId: string): MCPServerMetadata | undefined {
    return this.servers.get(serverId);
  }

  getAllServers(): MCPServerMetadata[] {
    return Array.from(this.servers.values());
  }

  getConnectedServers(): MCPServerMetadata[] {
    return Array.from(this.servers.values()).filter(
      server => server.status === 'connected'
    );
  }

  findServersByCapability(criteria: MCPServerSearchCriteria): MCPServerMetadata[] {
    const results: MCPServerMetadata[] = [];

    for (const server of this.servers.values()) {
      if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
        const hasAllCapabilities = criteria.requiredCapabilities.every(capability => {
          // Check if server has the capability in tools, resources, or prompts
          const client = this.clients.get(server.id);
          if (!client) return false;
          
          const serverCapabilities = client.getCapabilities();
          return (
            serverCapabilities.tools?.includes(capability) ||
            serverCapabilities.resources?.includes(capability) ||
            serverCapabilities.prompts?.includes(capability)
          );
        });

        if (!hasAllCapabilities) continue;
      }

      // Check keywords in name or description
      if (criteria.keywords && criteria.keywords.length > 0) {
        const searchText = `${server.name} ${server.description || ''}`.toLowerCase();
        const hasKeywords = criteria.keywords.some(keyword =>
          searchText.includes(keyword.toLowerCase())
        );

        if (!hasKeywords) continue;
      }

      results.push(server);
    }

    return results.slice(0, criteria.maxResults);
  }

  remove(serverId: string): void {
    this.servers.delete(serverId);
    const client = this.clients.get(serverId);
    if (client) {
      client.disconnect().catch(err => {
        logger.error(`Error disconnecting server ${serverId} during removal:`, err);
      });
      this.clients.delete(serverId);
    }
    logger.info(`Removed MCP server: ${serverId}`);
  }

  clear(): void {
    // Disconnect all clients
    const disconnectPromises = Array.from(this.clients.values()).map(client =>
      client.disconnect()
    );
    Promise.all(disconnectPromises).catch(err => {
      logger.error('Error disconnecting servers during clear:', err);
    });

    this.servers.clear();
    this.clients.clear();
  }
}

