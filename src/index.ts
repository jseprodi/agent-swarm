/**
 * Agent Swarm - Main entry point
 */

import { TaskManager } from './core/TaskManager.js';
import { Orchestrator } from './core/Orchestrator.js';
import { MessageQueue } from './communication/MessageQueue.js';
import { AgentRegistry } from './communication/AgentRegistry.js';
import { MCPManager } from './mcp/MCPManager.js';
import type { ILLMProvider, LLMProviderConfig } from './llm/types.js';
import { CursorLLMProvider } from './llm/providers/CursorLLMProvider.js';
import { OpenAIProvider } from './llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from './llm/providers/AnthropicProvider.js';
import { CodeAgent } from './agents/CodeAgent.js';
import { TestAgent } from './agents/TestAgent.js';
import { DocumentationAgent } from './agents/DocumentationAgent.js';
import { MCPDiscoveryAgent } from './agents/MCPDiscoveryAgent.js';
import { StylesheetAgent } from './agents/StylesheetAgent.js';
import { ErrorDebuggingAgent } from './agents/ErrorDebuggingAgent.js';
import { AccessibilityAgent } from './agents/AccessibilityAgent.js';
import type { Task, TaskResult } from './core/types.js';
import logger from './utils/logger.js';

export type LLMProviderType = 'cursor' | 'openai' | 'anthropic';

export interface SwarmConfig {
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  logLevel?: string;
  llmProvider?: LLMProviderType | ILLMProvider;
  llmConfig?: LLMProviderConfig;
}

/**
 * Main Swarm class that coordinates all agents and tasks
 */
export class Swarm {
  private taskManager: TaskManager;
  private messageQueue: MessageQueue;
  private agentRegistry: AgentRegistry;
  private mcpManager: MCPManager;
  private llm: ILLMProvider;
  private orchestrator: Orchestrator;
  private config: SwarmConfig;

  constructor(config: SwarmConfig = {}) {
    this.config = config;

    // Set log level if provided
    if (config.logLevel) {
      logger.level = config.logLevel;
    }

    // Initialize core components
    this.taskManager = new TaskManager();
    this.messageQueue = new MessageQueue();
    this.agentRegistry = new AgentRegistry();
    this.mcpManager = new MCPManager();
    
    // Initialize LLM provider
    this.llm = this.initializeLLMProvider(config);

    // Create orchestrator
    this.orchestrator = new Orchestrator(
      this.taskManager,
      this.messageQueue,
      this.agentRegistry,
      this.mcpManager,
      this.llm
    );

    // Register orchestrator
    this.agentRegistry.register(this.orchestrator);

    // Register domain agents
    this.registerDefaultAgents();

    // Start health checks if enabled
    if (config.enableHealthChecks) {
      this.mcpManager.startHealthChecks();
    }

    logger.info(`Agent Swarm initialized with LLM provider: ${this.llm.getName()}`);
  }

  /**
   * Initialize LLM provider based on configuration
   */
  private initializeLLMProvider(config: SwarmConfig): ILLMProvider {
    // If a provider instance is passed, use it
    if (config.llmProvider && typeof config.llmProvider === 'object') {
      logger.info(`Using provided LLM provider: ${config.llmProvider.getName()}`);
      return config.llmProvider;
    }

    // Otherwise, create provider based on type
    const providerType = (config.llmProvider || 'cursor') as LLMProviderType;

    switch (providerType) {
      case 'openai':
        logger.info('Initializing OpenAI LLM provider');
        return new OpenAIProvider(config.llmConfig);

      case 'anthropic':
        logger.info('Initializing Anthropic LLM provider');
        return new AnthropicProvider(config.llmConfig);

      case 'cursor':
      default:
        logger.info('Initializing Cursor LLM provider');
        return new CursorLLMProvider();
    }
  }

  /**
   * Get the current LLM provider
   */
  getLLMProvider(): ILLMProvider {
    return this.llm;
  }

  /**
   * Register default domain agents
   */
  private registerDefaultAgents(): void {
    const codeAgent = new CodeAgent(this.llm);
    const testAgent = new TestAgent(this.llm);
    const docAgent = new DocumentationAgent(this.llm);
    const mcpDiscoveryAgent = new MCPDiscoveryAgent(this.mcpManager, this.llm);
    const stylesheetAgent = new StylesheetAgent(this.llm);
    const errorDebuggingAgent = new ErrorDebuggingAgent(this.llm);
    const accessibilityAgent = new AccessibilityAgent(this.llm);

    this.agentRegistry.register(codeAgent);
    this.agentRegistry.register(testAgent);
    this.agentRegistry.register(docAgent);
    this.agentRegistry.register(mcpDiscoveryAgent);
    this.agentRegistry.register(stylesheetAgent);
    this.agentRegistry.register(errorDebuggingAgent);
    this.agentRegistry.register(accessibilityAgent);

    logger.info('Registered default agents: CodeAgent, TestAgent, DocumentationAgent, MCPDiscoveryAgent, StylesheetAgent, ErrorDebuggingAgent, AccessibilityAgent');
  }

  /**
   * Execute a high-level task
   */
  async execute(taskDescription: string, metadata?: Record<string, unknown>): Promise<TaskResult> {
    logger.info(`Executing task: ${taskDescription}`);

    // Create root task
    const task = this.taskManager.createTask(
      taskDescription,
      undefined,
      undefined,
      undefined,
      metadata
    );

    // Execute via orchestrator
    const result = await this.orchestrator.execute(task);

    logger.info(`Task execution completed: ${result.success ? 'success' : 'failed'}`);
    return result;
  }

  /**
   * Get task manager
   */
  getTaskManager(): TaskManager {
    return this.taskManager;
  }

  /**
   * Get message queue
   */
  getMessageQueue(): MessageQueue {
    return this.messageQueue;
  }

  /**
   * Get agent registry
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * Get MCP manager
   */
  getMCPManager(): MCPManager {
    return this.mcpManager;
  }

  /**
   * Get orchestrator
   */
  getOrchestrator(): Orchestrator {
    return this.orchestrator;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up Agent Swarm...');
    await this.mcpManager.cleanup();
    this.taskManager.clear();
    this.agentRegistry.clear();
    this.messageQueue.clearHistory();
    logger.info('Agent Swarm cleanup completed');
  }
}

// Export types and classes
export * from './core/types.js';
export * from './mcp/types.js';
export * from './communication/types.js';
export * from './agents/index.js';
export * from './llm/index.js';
export { TaskManager } from './core/TaskManager.js';
export { Orchestrator } from './core/Orchestrator.js';
export { MCPManager } from './mcp/MCPManager.js';
export { AgentRegistry } from './communication/AgentRegistry.js';
export { MessageQueue } from './communication/MessageQueue.js';

