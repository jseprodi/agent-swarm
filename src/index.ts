/**
 * Agent Swarm - Main entry point
 */

import { TaskManager } from './core/TaskManager.js';
import { Orchestrator } from './core/Orchestrator.js';
import { MessageQueue } from './communication/MessageQueue.js';
import { AgentRegistry } from './communication/AgentRegistry.js';
import { MCPManager } from './mcp/MCPManager.js';
import { DEFAULT_HEALTH_CHECK_INTERVAL_MS } from './mcp/constants.js';
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
import { DatabaseAgent } from './agents/DatabaseAgent.js';
import { UnitTestAgent } from './agents/UnitTestAgent.js';
import type { TaskResult, DynamicAgentConfig } from './core/types.js';
import logger from './utils/logger.js';

export type LLMProviderType = 'cursor' | 'openai' | 'anthropic';

export interface CachingConfig {
  enabled: boolean;
  llmCache?: {
    enabled: boolean;
    ttl?: number; // Time to live in milliseconds
    maxSize?: number;
  };
  taskCache?: {
    enabled: boolean;
    ttl?: number;
  };
  storage?: 'memory' | 'file' | 'hybrid';
  cacheDirectory?: string;
}

export interface DistributedExecutionConfig {
  enabled: boolean;
  nodeId?: string;
  discoveryMethod?: 'static' | 'dynamic';
  nodes?: Array<{ id: string; url: string }>;
  transport?: 'http' | 'websocket';
}

export interface ErrorRecoveryConfig {
  enabled: boolean;
  maxRetries?: number;
  retryStrategy?: 'exponential' | 'fixed' | 'adaptive';
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold?: number;
    recoveryTimeout?: number;
  };
  fallbackAgents?: boolean;
}

export interface SwarmConfig {
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  logLevel?: string;
  llmProvider?: LLMProviderType | ILLMProvider;
  llmConfig?: LLMProviderConfig;
  dynamicAgents?: DynamicAgentConfig;
  caching?: CachingConfig;
  distributedExecution?: DistributedExecutionConfig;
  errorRecovery?: ErrorRecoveryConfig;
  orchestratorTimeout?: number; // Timeout in milliseconds for orchestrator task execution
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
  // @ts-expect-error - Config stored for potential future runtime configuration updates
  private _config: SwarmConfig;

  constructor(config: SwarmConfig = {}) {
    this._config = config;

    // Set log level if provided
    if (config.logLevel) {
      logger.level = config.logLevel;
    }

    // Initialize core components
    this.taskManager = new TaskManager();
    this.messageQueue = new MessageQueue();
    this.agentRegistry = new AgentRegistry();
    this.mcpManager = new MCPManager(
      undefined,
      config.healthCheckInterval || DEFAULT_HEALTH_CHECK_INTERVAL_MS
    );
    
    // Initialize LLM provider
    this.llm = this.initializeLLMProvider(config);

    // Create orchestrator with dynamic agent config
    this.orchestrator = new Orchestrator(
      this.taskManager,
      this.messageQueue,
      this.agentRegistry,
      this.mcpManager,
      this.llm,
      undefined, // maxConcurrentTasks
      config.dynamicAgents,
      undefined, // metricsCollector
      config.orchestratorTimeout
    );

    // Register orchestrator
    this.agentRegistry.register(this.orchestrator);

    // Register domain agents
    this.registerDefaultAgents();

    // Load persisted dynamic agents if enabled (async, but don't block constructor)
    if (config.dynamicAgents?.enabled) {
      this.loadPersistedAgents().catch(error => {
        logger.warn('Failed to load persisted agents during initialization:', error);
      });
    }

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
   * Load persisted dynamic agents
   */
  private async loadPersistedAgents(): Promise<void> {
    try {
      const orchestrator = this.orchestrator;
      const agentFactory = orchestrator.getAgentFactory();
      
      if (agentFactory) {
        const loadedAgents = await agentFactory.loadPersistedAgents();
        logger.info(`Loaded ${loadedAgents.length} persisted dynamic agents`);
      }
    } catch (error) {
      logger.warn('Failed to load persisted agents:', error);
    }
  }

  /**
   * Register default domain agents
   */
  private registerDefaultAgents(): void {
    // Note: Most agents don't accept MessageQueue in constructor yet
    // This is a forward-compatible setup - agents that need it can be updated
    const codeAgent = new CodeAgent(this.llm);
    const testAgent = new TestAgent(this.llm);
    const docAgent = new DocumentationAgent(this.llm);
    const mcpDiscoveryAgent = new MCPDiscoveryAgent(this.mcpManager, this.llm);
    const stylesheetAgent = new StylesheetAgent(this.llm);
    const errorDebuggingAgent = new ErrorDebuggingAgent(this.llm);
    const accessibilityAgent = new AccessibilityAgent(this.llm);
    const databaseAgent = new DatabaseAgent(this.llm);
    const unitTestAgent = new UnitTestAgent(this.llm);

    // Inject MessageQueue into agents that support it (via protected property)
    // This is a workaround until all agents are updated to accept it in constructor
    (codeAgent as any).messageQueue = this.messageQueue;
    (testAgent as any).messageQueue = this.messageQueue;
    (docAgent as any).messageQueue = this.messageQueue;
    (mcpDiscoveryAgent as any).messageQueue = this.messageQueue;
    (stylesheetAgent as any).messageQueue = this.messageQueue;
    (errorDebuggingAgent as any).messageQueue = this.messageQueue;
    (accessibilityAgent as any).messageQueue = this.messageQueue;
    (databaseAgent as any).messageQueue = this.messageQueue;
    (unitTestAgent as any).messageQueue = this.messageQueue;

    this.agentRegistry.register(codeAgent);
    this.agentRegistry.register(testAgent);
    this.agentRegistry.register(docAgent);
    this.agentRegistry.register(mcpDiscoveryAgent);
    this.agentRegistry.register(stylesheetAgent);
    this.agentRegistry.register(errorDebuggingAgent);
    this.agentRegistry.register(accessibilityAgent);
    this.agentRegistry.register(databaseAgent);
    this.agentRegistry.register(unitTestAgent);

    logger.info('Registered default agents: CodeAgent, TestAgent, DocumentationAgent, MCPDiscoveryAgent, StylesheetAgent, ErrorDebuggingAgent, AccessibilityAgent, DatabaseAgent, UnitTestAgent');
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
    try {
      await this.mcpManager.cleanup();
    } catch (error) {
      logger.warn('Error during MCP manager cleanup:', error);
    }
    try {
      this.taskManager.clear();
      this.agentRegistry.clear();
      this.messageQueue.clearHistory();
    } catch (error) {
      logger.warn('Error during component cleanup:', error);
    }
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

