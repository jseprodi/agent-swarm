/**
 * Base Agent class and interface
 */

import type { Agent, Task, TaskResult, AgentMetadata, AgentCapability } from './types.js';
import type { ILLMProvider } from '../llm/types.js';
import { BaseLLMProvider } from '../llm/BaseLLMProvider.js';
import { CursorLLMProvider } from '../llm/providers/CursorLLMProvider.js';
import type { MCPServerClient } from '../mcp/MCPServerClient.js';
import type { MetricsCollector } from '../metrics/MetricsCollector.js';
import type { MessageQueue } from '../communication/MessageQueue.js';
import type { Message, MessageType } from '../communication/types.js';
import { v4 as uuidv4 } from 'uuid';
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
  protected metricsCollector?: MetricsCollector;
  protected messageQueue?: MessageQueue;

  constructor(
    id: string,
    name: string,
    description: string,
    capabilities: AgentCapability[],
    llm?: ILLMProvider,
    metricsCollector?: MetricsCollector,
    messageQueue?: MessageQueue
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
    this.llm = llm || new CursorLLMProvider();
    this.metricsCollector = metricsCollector;
    this.messageQueue = messageQueue;
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
    metadata?: Record<string, unknown>,
    executionTime?: number
  ): TaskResult {
    const result: TaskResult = {
      taskId,
      success: true,
      data,
      metadata,
      mcpServersUsed: Array.from(this.mcpClients.keys()),
      executionTime,
    };

    // Record metrics
    if (this.metricsCollector) {
      this.metricsCollector.counter('agent_task_success', { agent: this.id }).inc();
      if (executionTime !== undefined) {
        this.metricsCollector.timer('agent_execution_time', { agent: this.id }).record(executionTime);
      }
    }

    return result;
  }

  /**
   * Helper method to create a failed task result
   */
  protected createFailureResult(
    taskId: string,
    error: string,
    metadata?: Record<string, unknown>,
    executionTime?: number
  ): TaskResult {
    const result: TaskResult = {
      taskId,
      success: false,
      error,
      metadata,
      mcpServersUsed: Array.from(this.mcpClients.keys()),
      executionTime,
    };

    // Record metrics
    if (this.metricsCollector) {
      this.metricsCollector.counter('agent_task_failure', { agent: this.id }).inc();
      if (executionTime !== undefined) {
        this.metricsCollector.timer('agent_execution_time', { agent: this.id }).record(executionTime);
      }
    }

    return result;
  }

  /**
   * Execute task with metrics tracking (wrapper for subclasses)
   */
  protected async executeWithMetrics(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    let result: TaskResult;

    try {
      result = await this.execute(task);
      const executionTime = Date.now() - startTime;

      // Update result with execution time
      if (result.success) {
        return this.createSuccessResult(task.id, result.data, result.metadata, executionTime);
      } else {
        return this.createFailureResult(task.id, result.error || 'Unknown error', result.metadata, executionTime);
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.createFailureResult(task.id, errorMessage, undefined, executionTime);
    }
  }

  /**
   * Send direct message to another agent
   */
  protected sendMessageToAgent(targetAgentId: string, messageType: MessageType, payload: unknown): void {
    if (!this.messageQueue) {
      logger.warn(`Agent ${this.id} attempted to send message but MessageQueue not available`);
      return;
    }

    const message: Message = {
      id: uuidv4(),
      type: messageType,
      payload,
      timestamp: new Date(),
      sourceAgentId: this.id,
      targetAgentId,
    };

    this.messageQueue.sendDirectMessage(targetAgentId, message);
    logger.debug(`Agent ${this.id} sent ${messageType} message to ${targetAgentId}`);
  }

  /**
   * Request/response pattern - send message and wait for response
   */
  protected async requestFromAgent(
    targetAgentId: string,
    messageType: MessageType,
    payload: unknown,
    timeout: number = 30000
  ): Promise<Message> {
    if (!this.messageQueue) {
      throw new Error(`Agent ${this.id} attempted to request from agent but MessageQueue not available`);
    }

    const message: Message = {
      id: uuidv4(),
      type: messageType,
      payload,
      timestamp: new Date(),
      sourceAgentId: this.id,
      targetAgentId,
    };

    logger.debug(`Agent ${this.id} requesting ${messageType} from ${targetAgentId}`);
    return await this.messageQueue.requestResponse(targetAgentId, message, timeout);
  }

  /**
   * Subscribe to messages from a specific agent
   */
  protected subscribeToAgentMessages(agentId: string, messageType: MessageType, handler: (message: Message) => void): void {
    if (!this.messageQueue) {
      logger.warn(`Agent ${this.id} attempted to subscribe but MessageQueue not available`);
      return;
    }

    this.messageQueue.registerAgentHandler(agentId, messageType, handler);
    logger.debug(`Agent ${this.id} subscribed to ${messageType} messages from ${agentId}`);
  }

  /**
   * Respond to a request message
   */
  protected respondToMessage(originalMessage: Message, responseType: MessageType, payload: unknown): void {
    if (!this.messageQueue || !originalMessage.sourceAgentId) {
      return;
    }

    const response: Message = {
      id: uuidv4(),
      type: responseType,
      payload,
      timestamp: new Date(),
      sourceAgentId: this.id,
      targetAgentId: originalMessage.sourceAgentId,
      correlationId: originalMessage.correlationId || originalMessage.id,
    };

    this.messageQueue.sendDirectMessage(originalMessage.sourceAgentId, response);
    logger.debug(`Agent ${this.id} responded to message ${originalMessage.id}`);
  }

  /**
   * Broadcast message to all agents
   */
  protected broadcastMessage(messageType: MessageType, payload: unknown): void {
    if (!this.messageQueue) {
      logger.warn(`Agent ${this.id} attempted to broadcast but MessageQueue not available`);
      return;
    }

    const message: Message = {
      id: uuidv4(),
      type: messageType,
      payload,
      timestamp: new Date(),
      sourceAgentId: this.id,
    };

    this.messageQueue.broadcast(message);
    logger.debug(`Agent ${this.id} broadcast ${messageType} message`);
  }
}

