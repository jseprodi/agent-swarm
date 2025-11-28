/**
 * MCP Server Client for communicating with MCP servers
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { 
  MCPServerMetadata, 
  MCPServerConnectionConfig,
  MCPServerCapability 
} from './types.js';
import logger from '../utils/logger.js';

export class MCPServerClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private metadata: MCPServerMetadata;
  private capabilities: MCPServerCapability = {};

  constructor(metadata: MCPServerMetadata) {
    this.metadata = metadata;
  }

  async connect(): Promise<void> {
    if (this.metadata.status === 'connected') {
      logger.warn(`MCP server ${this.metadata.id} is already connected`);
      return;
    }

    try {
      this.metadata.status = 'connecting';
      logger.info(`Connecting to MCP server: ${this.metadata.name} (${this.metadata.id})`);

      if (this.metadata.connectionType === 'stdio') {
        if (!this.metadata.connectionConfig.command) {
          throw new Error('Stdio connection requires a command');
        }

        this.transport = new StdioClientTransport({
          command: this.metadata.connectionConfig.command,
          args: this.metadata.connectionConfig.args || [],
          env: this.metadata.connectionConfig.env,
        });

        this.client = new Client(
          {
            name: 'agent-swarm',
            version: '0.1.0',
          },
          {
            capabilities: {},
          }
        );

        await this.client.connect(this.transport);
        
        // Discover capabilities
        await this.discoverCapabilities();
        
        this.metadata.status = 'connected';
        this.metadata.lastConnected = new Date();
        this.metadata.errorCount = 0;
        logger.info(`Successfully connected to MCP server: ${this.metadata.name}`);
      } else {
        throw new Error(`Connection type ${this.metadata.connectionType} not yet implemented`);
      }
    } catch (error) {
      this.metadata.status = 'error';
      this.metadata.errorCount = (this.metadata.errorCount || 0) + 1;
      logger.error(`Failed to connect to MCP server ${this.metadata.name}:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        logger.error(`Error disconnecting from MCP server ${this.metadata.name}:`, error);
      }
      this.client = null;
      this.transport = null;
    }
    this.metadata.status = 'disconnected';
    logger.info(`Disconnected from MCP server: ${this.metadata.name}`);
  }

  private async discoverCapabilities(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      // List available tools
      const toolsResponse = await this.client.listTools();
      this.capabilities.tools = toolsResponse.tools.map(tool => tool.name);

      // List available resources
      const resourcesResponse = await this.client.listResources();
      this.capabilities.resources = resourcesResponse.resources.map(resource => resource.uri);

      // List available prompts
      const promptsResponse = await this.client.listPrompts();
      this.capabilities.prompts = promptsResponse.prompts.map(prompt => prompt.name);

      logger.info(`Discovered capabilities for ${this.metadata.name}:`, this.capabilities);
    } catch (error) {
      logger.warn(`Error discovering capabilities for ${this.metadata.name}:`, error);
      // Continue with empty capabilities
    }
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.callTool({ name, arguments: args || {} });
      return result;
    } catch (error) {
      logger.error(`Error calling tool ${name} on ${this.metadata.name}:`, error);
      throw error;
    }
  }

  async getResource(uri: string): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      logger.error(`Error getting resource ${uri} from ${this.metadata.name}:`, error);
      throw error;
    }
  }

  async getPrompt(name: string, args?: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const result = await this.client.getPrompt({ name, arguments: args || {} });
      return result;
    } catch (error) {
      logger.error(`Error getting prompt ${name} from ${this.metadata.name}:`, error);
      throw error;
    }
  }

  getCapabilities(): MCPServerCapability {
    return { ...this.capabilities };
  }

  getMetadata(): MCPServerMetadata {
    return { ...this.metadata };
  }

  isConnected(): boolean {
    return this.metadata.status === 'connected' && this.client !== null;
  }
}

