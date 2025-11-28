/**
 * MCP Manager handles connection lifecycle, health checks, and error recovery
 */

import type { MCPServerMetadata, MCPServerConnectionConfig } from './types.js';
import { MCPRegistry } from './MCPRegistry.js';
import { MCPServerClient } from './MCPServerClient.js';
import { DEFAULT_HEALTH_CHECK_INTERVAL_MS } from './constants.js';
import logger from '../utils/logger.js';

export class MCPManager {
  private registry: MCPRegistry;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly healthCheckIntervalMs: number;

  constructor(registry?: MCPRegistry, healthCheckIntervalMs?: number) {
    this.registry = registry || new MCPRegistry();
    this.healthCheckIntervalMs = healthCheckIntervalMs || DEFAULT_HEALTH_CHECK_INTERVAL_MS;
  }

  /**
   * Add a new MCP server to the registry
   */
  addServer(metadata: MCPServerMetadata): void {
    this.registry.register(metadata);
  }

  /**
   * Connect to an MCP server
   */
  async connectServer(serverId: string): Promise<MCPServerClient> {
    try {
      const client = await this.registry.connect(serverId);
      logger.info(`Successfully connected to MCP server: ${serverId}`);
      return client;
    } catch (error) {
      logger.error(`Failed to connect to MCP server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Connect to multiple MCP servers
   */
  async connectServers(serverIds: string[]): Promise<Map<string, MCPServerClient>> {
    const clients = new Map<string, MCPServerClient>();
    const results = await Promise.allSettled(
      serverIds.map(async id => {
        const client = await this.connectServer(id);
        return { id, client };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        clients.set(result.value.id, result.value.client);
      } else {
        logger.error(`Failed to connect server:`, result.reason);
      }
    }

    return clients;
  }

  /**
   * Disconnect from an MCP server
   */
  async disconnectServer(serverId: string): Promise<void> {
    try {
      await this.registry.disconnect(serverId);
      logger.info(`Disconnected from MCP server: ${serverId}`);
    } catch (error) {
      logger.error(`Error disconnecting from MCP server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get a connected client for an MCP server
   */
  getClient(serverId: string): MCPServerClient | undefined {
    return this.registry.getClient(serverId);
  }

  /**
   * Get server metadata
   */
  getServerMetadata(serverId: string): MCPServerMetadata | undefined {
    return this.registry.getMetadata(serverId);
  }

  /**
   * Find servers by capability
   */
  findServersByCapability(capabilities: string[]): MCPServerMetadata[] {
    return this.registry.findServersByCapability({
      requiredCapabilities: capabilities,
    });
  }

  /**
   * Start health checks for connected servers
   */
  startHealthChecks(): void {
    if (this.healthCheckInterval) {
      logger.warn('Health checks already running');
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks().catch(error => {
        logger.error('Error during health checks:', error);
      });
    }, this.healthCheckIntervalMs);

    logger.info('Started MCP server health checks');
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Stopped MCP server health checks');
    }
  }

  /**
   * Perform health checks on all connected servers
   */
  private async performHealthChecks(): Promise<void> {
    const connectedServers = this.registry.getConnectedServers();
    
    for (const server of connectedServers) {
      const client = this.registry.getClient(server.id);
      if (!client || !client.isConnected()) {
        logger.warn(`MCP server ${server.id} appears disconnected, attempting reconnect...`);
        try {
          await this.registry.disconnect(server.id);
          await this.connectServer(server.id);
        } catch (error) {
          logger.error(`Failed to reconnect to server ${server.id}:`, error);
        }
      } else {
        // Try a lightweight operation to verify connection
        try {
          await client.callTool('ping', {}).catch(() => {
            // If ping doesn't exist, that's ok - server is still responsive
          });
        } catch (error) {
          logger.warn(`Health check failed for server ${server.id}, marking as error`);
          const metadata = this.registry.getMetadata(server.id);
          if (metadata) {
            metadata.status = 'error';
            metadata.errorCount = (metadata.errorCount || 0) + 1;
          }
        }
      }
    }
  }

  /**
   * Get the registry instance
   */
  getRegistry(): MCPRegistry {
    return this.registry;
  }

  /**
   * Cleanup: disconnect all servers and stop health checks
   */
  async cleanup(): Promise<void> {
    this.stopHealthChecks();
    const connectedServers = this.registry.getConnectedServers();
    await Promise.allSettled(
      connectedServers.map(server => this.disconnectServer(server.id))
    );
  }
}

