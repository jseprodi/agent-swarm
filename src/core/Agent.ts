/**
 * Base Agent class and interface
 */

import type { Agent, Task, TaskResult, AgentMetadata, AgentCapability } from './types.js';
import type { ILLMProvider } from '../llm/types.js';
import { BaseLLMProvider } from '../llm/BaseLLMProvider.js';
import { CursorLLMProvider } from '../llm/providers/CursorLLMProvider.js';
import type { MCPServerClient } from '../mcp/MCPServerClient.js';
import logger from '../utils/logger.js';

/**
 * Base abstract class for all agents
 */
export abstract class BaseAgent implements Agent {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;
  public readonly capabilities: AgentCapability[];
  protected llm: ILLMProvider;
  protected mcpClients: Map<string, MCPServerClient> = new Map();

  constructor(
    id: string,
    name: string,
    description: string,
    capabilities: AgentCapability[],
    llm?: ILLMProvider
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.llm = llm || new CursorLLMProvider();
  }

  /**
   * Get LLM provider helper methods if available
   */
  protected getLLMHelpers(): BaseLLMProvider | null {
    return this.llm instanceof BaseLLMProvider ? this.llm : null;
  }

  /**
   * Execute a task - must be implemented by subclasses
   */
  abstract execute(task: Task): Promise<TaskResult>;

  /**
   * Determine if this agent can handle a task
   */
  canHandle(task: Task): boolean {
    // Check if agent has required capabilities
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const hasAllCapabilities = task.requiredCapabilities.every(capability =>
        this.capabilities.includes(capability)
      );

      if (!hasAllCapabilities) {
        logger.debug(
          `Agent ${this.id} cannot handle task ${task.id}: missing capabilities`
        );
        return false;
      }
    }

    // Check if required MCP servers are available
    if (task.requiredMCPServers && task.requiredMCPServers.length > 0) {
      const hasAllServers = task.requiredMCPServers.every(serverId =>
        this.mcpClients.has(serverId)
      );

      if (!hasAllServers) {
        logger.debug(
          `Agent ${this.id} cannot handle task ${task.id}: missing MCP servers`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Add an MCP client for this agent to use
   */
  addMCPClient(serverId: string, client: MCPServerClient): void {
    this.mcpClients.set(serverId, client);
    logger.debug(`Agent ${this.id} now has access to MCP server: ${serverId}`);
  }

  /**
   * Remove an MCP client
   */
  removeMCPClient(serverId: string): void {
    this.mcpClients.delete(serverId);
    logger.debug(`Agent ${this.id} lost access to MCP server: ${serverId}`);
  }

  /**
   * Get an MCP client by server ID
   */
  protected getMCPClient(serverId: string): MCPServerClient | undefined {
    return this.mcpClients.get(serverId);
  }

  /**
   * Get metadata about this agent
   */
  getMetadata(): AgentMetadata {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
      mcpServersUsed: Array.from(this.mcpClients.keys()),
    };
  }

  /**
   * Helper method to create a successful task result
   */
  protected createSuccessResult(
    taskId: string,
    data?: unknown,
    metadata?: Record<string, unknown>
  ): TaskResult {
    return {
      taskId,
      success: true,
      data,
      metadata,
      mcpServersUsed: Array.from(this.mcpClients.keys()),
    };
  }

  /**
   * Helper method to create a failed task result
   */
  protected createFailureResult(
    taskId: string,
    error: string,
    metadata?: Record<string, unknown>
  ): TaskResult {
    return {
      taskId,
      success: false,
      error,
      metadata,
      mcpServersUsed: Array.from(this.mcpClients.keys()),
    };
  }
}

