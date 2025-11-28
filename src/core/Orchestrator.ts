/**
 * Orchestrator Agent - coordinates tasks and delegates to sub-agents
 */

import { BaseAgent } from './Agent.js';
import type { Agent, Task, TaskResult, TaskDecomposition } from './types.js';
import { TaskManager } from './TaskManager.js';
import type { ILLMProvider } from '../llm/types.js';
import { MessageQueue } from '../communication/MessageQueue.js';
import type { Message } from '../communication/types.js';
import { AgentRegistry } from '../communication/AgentRegistry.js';
import { MCPManager } from '../mcp/MCPManager.js';
import { MCPDiscoveryAgent } from '../agents/MCPDiscoveryAgent.js';
import { AgentFactory } from '../agents/AgentFactory.js';
import { TASK_DEPENDENCY_POLL_INTERVAL_MS } from './constants.js';
import type { DynamicAgentConfig, AgentPersistenceOptions, Agent } from './types.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator extends BaseAgent {
  private taskManager: TaskManager;
  private messageQueue: MessageQueue;
  private agentRegistry: AgentRegistry;
  private mcpManager: MCPManager;
  private mcpDiscoveryAgent: MCPDiscoveryAgent;
  private agentFactory: AgentFactory;
  private dynamicAgentConfig: DynamicAgentConfig;
  private createdAgentsCount: number = 0;
  private isProcessing: boolean = false;
  private readonly maxConcurrentTasks: number;

  constructor(
    taskManager: TaskManager,
    messageQueue: MessageQueue,
    agentRegistry: AgentRegistry,
    mcpManager: MCPManager,
    llm?: ILLMProvider,
    maxConcurrentTasks?: number,
    dynamicAgentConfig?: DynamicAgentConfig
  ) {
    super(
      'orchestrator',
      'Orchestrator Agent',
      'Coordinates tasks, decomposes them, and delegates to appropriate sub-agents',
      ['orchestration', 'task_decomposition', 'agent_selection'],
      llm
    );

    this.taskManager = taskManager;
    this.messageQueue = messageQueue;
    this.agentRegistry = agentRegistry;
    this.mcpManager = mcpManager;
    this.mcpDiscoveryAgent = new MCPDiscoveryAgent(mcpManager, llm);
    this.maxConcurrentTasks = maxConcurrentTasks || 10; // Default to 10 concurrent tasks

    // Initialize dynamic agent configuration
    this.dynamicAgentConfig = dynamicAgentConfig || {
      enabled: false,
      maxDynamicAgents: 10,
      defaultPersistence: {
        persist: false,
        persistConfig: false,
        persistCode: false,
      },
      agentCreationThreshold: 0.5,
      persistenceDirectory: 'data/agents/dynamic',
    };

    // Initialize agent factory if dynamic agents are enabled
    if (this.dynamicAgentConfig.enabled) {
      this.agentFactory = new AgentFactory(
        agentRegistry,
        llm || this.llm,
        this.dynamicAgentConfig.persistenceDirectory
      );
    }

    // Subscribe to task completion messages
    this.messageQueue.subscribe('task_completed', this.handleTaskCompleted.bind(this));
    this.messageQueue.subscribe('task_failed', this.handleTaskFailed.bind(this));
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`Orchestrator executing task: ${task.id} - ${task.description}`);

    if (this.isProcessing) {
      logger.warn('Orchestrator is already processing a task');
      return this.createFailureResult(task.id, 'Orchestrator is busy processing another task');
    }

    this.isProcessing = true;

    // Add overall timeout to prevent hanging (15 seconds max - must be less than test timeout)
    const MAX_EXECUTION_TIME_MS = 15000;
    const executionPromise = (async () => {
      try {
        // Step 1: Ensure MCP servers are available
        await this.ensureMCPServers(task);

        // Step 2: Decompose the task
        const decomposition = await this.decomposeTask(task);

        // Step 3: Create subtasks
        const subtasks = this.createSubtasks(task, decomposition);

        // Step 4: Execute subtasks in order
        const results = await this.executeSubtasks(subtasks);

        // Step 5: Synthesize results
        const synthesizedResult = await this.synthesizeResults(task, results);

        return synthesizedResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Orchestrator error:`, error);
        return this.createFailureResult(task.id, errorMessage);
      } finally {
        this.isProcessing = false;
      }
    })();

    const timeoutPromise = new Promise<TaskResult>((resolve) => 
      setTimeout(() => {
        logger.error(`Orchestrator execution timeout for task ${task.id}`);
        this.isProcessing = false;
        resolve(this.createFailureResult(task.id, 'Execution timeout'));
      }, MAX_EXECUTION_TIME_MS)
    );

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Ensure required MCP servers are available
   */
  private async ensureMCPServers(task: Task): Promise<void> {
    // Determine required MCP servers
    const requiredServers = task.requiredMCPServers || [];

    if (requiredServers.length === 0) {
      // Try to determine requirements from task description
      const llmHelpers = this.getLLMHelpers();
      if (this.llm.isAvailable() && llmHelpers) {
        // Add timeout to prevent hanging
        const determinePromise = llmHelpers.determineRequiredMCPServers(task.description);
        const timeoutPromise = new Promise<string[]>((resolve) => 
          setTimeout(() => resolve([]), 5000)
        );
        const requiredCapabilities = await Promise.race([determinePromise, timeoutPromise]);
        if (requiredCapabilities.length > 0) {
          // Create a discovery task
          const discoveryTask = this.taskManager.createTask(
            `Discover MCP servers for capabilities: ${requiredCapabilities.join(', ')}`,
            task.id,
            ['mcp_discovery'],
            undefined,
            { requiredCapabilities }
          );

          // Add timeout to prevent hanging
          try {
            const discoveryPromise = this.mcpDiscoveryAgent.execute(discoveryTask);
            const timeoutPromise = new Promise<TaskResult>((resolve) => 
              setTimeout(() => resolve({ taskId: discoveryTask.id, success: false, error: 'Discovery timeout' }), 5000)
            );
            const discoveryResult = await Promise.race([discoveryPromise, timeoutPromise]);
            
            if (discoveryResult.success && discoveryResult.data) {
              const data = discoveryResult.data as { connectedServers: string[] };
              task.requiredMCPServers = data.connectedServers;
              logger.info(`Discovered and connected ${data.connectedServers.length} MCP servers`);
            }
          } catch (error) {
            logger.warn('MCP discovery failed or timed out', error);
          }
        }
      }
    }

    // Check if required servers are connected
    for (const serverId of task.requiredMCPServers || []) {
      const client = this.mcpManager.getClient(serverId);
      if (!client || !client.isConnected()) {
        logger.warn(`Required MCP server ${serverId} is not connected, attempting to connect...`);
        try {
          await this.mcpManager.connectServer(serverId);
        } catch (error) {
          logger.error(`Failed to connect to required MCP server ${serverId}:`, error);
        }
      }
    }
  }

  /**
   * Decompose a task into subtasks using LLM
   */
  private async decomposeTask(task: Task): Promise<TaskDecomposition> {
    logger.info(`Decomposing task: ${task.id}`);

    // Get available agents
    const availableAgents = this.agentRegistry.getAvailableAgents();
    const agentMetadata = availableAgents.map(agent => ({
      id: agent.id,
      capabilities: agent.capabilities,
      description: agent.description,
    }));

    // Use LLM to decompose the task
    const llmHelpers = this.getLLMHelpers();
    if (this.llm.isAvailable() && llmHelpers && agentMetadata.length > 0) {
      try {
        // Add timeout to prevent hanging
        const decompositionPromise = llmHelpers.decomposeTask(
          task.description,
          agentMetadata.map(a => a.id)
        );
        const timeoutPromise = new Promise<{ subtasks: Array<{ description: string; agent: string; dependencies?: string[] }>; reasoning: string }>((_, reject) => 
          setTimeout(() => reject(new Error('Decomposition timeout')), 10000)
        );
        const decomposition = await Promise.race([decompositionPromise, timeoutPromise]);

        logger.info(`LLM decomposed task into ${decomposition.subtasks.length} subtasks`);

        // Check if we should create specialized agents during decomposition
        if (this.dynamicAgentConfig.enabled && this.agentFactory) {
          for (const subtask of decomposition.subtasks) {
            // Check if this subtask might benefit from a specialized agent
            const shouldCreate = await this.shouldCreateAgent(subtask.description, task);
            if (shouldCreate) {
              try {
                await this.createAgentForTask(subtask.description, task);
                // Update available agents list after creation
                const updatedAgents = this.agentRegistry.getAvailableAgents();
                agentMetadata.push(...updatedAgents
                  .filter(a => !agentMetadata.some(am => am.id === a.id))
                  .map(a => ({
                    id: a.id,
                    capabilities: a.capabilities,
                    description: a.description,
                  }))
                );
              } catch (error) {
                logger.warn(`Failed to create agent during decomposition for subtask: ${subtask.description}`, error);
              }
            }
          }
        }

        // Convert to TaskDecomposition format
        const subtasks: Task[] = [];
        const dependencies = new Map<string, string[]>();
        const subtaskDescriptions = new Map<string, string>();

        // Create subtasks
        for (const subtask of decomposition.subtasks) {
          const subtaskTask = this.taskManager.createTask(
            subtask.description,
            task.id,
            undefined, // Capabilities will be determined by agent
            undefined
          );
          subtasks.push(subtaskTask);
          subtaskDescriptions.set(subtaskTask.id, subtask.description);

          // Handle dependencies
          if (subtask.dependencies && subtask.dependencies.length > 0) {
            // Find dependent subtask IDs by matching descriptions
            const depIds: string[] = [];
            for (const depDesc of subtask.dependencies) {
              for (const [id, desc] of subtaskDescriptions.entries()) {
                if (desc.toLowerCase().includes(depDesc.toLowerCase()) ||
                    depDesc.toLowerCase().includes(desc.toLowerCase())) {
                  depIds.push(id);
                  break;
                }
              }
            }
            if (depIds.length > 0) {
              dependencies.set(subtaskTask.id, depIds);
              for (const depId of depIds) {
                this.taskManager.addDependency(subtaskTask.id, depId);
              }
            }
          }
        }

        // Build execution order (topological sort)
        const executionOrder = this.topologicalSort(subtasks, dependencies);

        return {
          tasks: subtasks,
          dependencies,
          estimatedExecutionOrder: executionOrder,
        };
      } catch (error) {
        logger.warn('LLM decomposition failed, using simple fallback', error);
      }
    }

    // Fallback: create a single subtask
    const subtask = this.taskManager.createTask(
      task.description,
      task.id,
      task.requiredCapabilities,
      task.requiredMCPServers
    );

    return {
      tasks: [subtask],
      dependencies: new Map(),
      estimatedExecutionOrder: [subtask.id],
    };
  }

  /**
   * Create subtasks from decomposition
   */
  private createSubtasks(task: Task, decomposition: TaskDecomposition): Task[] {
    return decomposition.tasks;
  }

  /**
   * Execute subtasks with parallel execution where dependencies allow
   */
  private async executeSubtasks(subtasks: Task[]): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();

    // Group tasks by dependency level for parallel execution
    const taskLevels = this.groupTasksByDependencyLevel(subtasks);

    // Execute tasks level by level, with parallel execution within each level
    for (const level of taskLevels) {
      logger.info(`Executing ${level.length} tasks in parallel at dependency level ${taskLevels.indexOf(level) + 1}`);

      // Execute all tasks at this level in parallel (with concurrency limit)
      const levelPromises = level.map(taskId => this.executeSingleTask(taskId, results));
      
      // Limit concurrent execution to avoid overwhelming the system
      if (levelPromises.length > this.maxConcurrentTasks) {
        // Execute in batches
        for (let i = 0; i < levelPromises.length; i += this.maxConcurrentTasks) {
          const batch = levelPromises.slice(i, i + this.maxConcurrentTasks);
          await Promise.allSettled(batch);
        }
      } else {
        await Promise.allSettled(levelPromises);
      }
    }

    return results;
  }

  /**
   * Group tasks by dependency level for parallel execution
   * Tasks at the same level have no dependencies on each other and can run in parallel
   */
  private groupTasksByDependencyLevel(tasks: Task[]): string[][] {
    const levels: string[][] = [];
    const remaining = new Set(tasks.map(t => t.id));
    const completed = new Set<string>();

    while (remaining.size > 0) {
      const currentLevel: string[] = [];

      // Find all tasks that have no remaining dependencies
      for (const taskId of remaining) {
        const task = this.taskManager.getTask(taskId);
        if (!task) {
          remaining.delete(taskId);
          continue;
        }

        const dependencies = task.dependencies || [];
        const allDependenciesCompleted = dependencies.every(depId => completed.has(depId));

        if (allDependenciesCompleted) {
          currentLevel.push(taskId);
        }
      }

      if (currentLevel.length === 0) {
        // No tasks can be executed - might be circular dependency or missing dependencies
        logger.warn('No tasks can be executed at this level. Remaining tasks:', Array.from(remaining));
        // Add remaining tasks to avoid infinite loop
        currentLevel.push(...Array.from(remaining));
      }

      levels.push(currentLevel);
      currentLevel.forEach(id => {
        remaining.delete(id);
        completed.add(id);
      });
    }

    return levels;
  }

  /**
   * Execute a single task
   */
  private async executeSingleTask(taskId: string, results: Map<string, TaskResult>): Promise<void> {
    const subtask = this.taskManager.getTask(taskId);
    if (!subtask) {
      logger.warn(`Task ${taskId} not found`);
      return;
    }

    // Wait for dependencies (should already be satisfied due to level grouping, but double-check)
    // Add timeout to prevent infinite loops
    const MAX_DEPENDENCY_WAIT_MS = 30000; // 30 seconds max wait
    const startTime = Date.now();
    while (!this.taskManager.areDependenciesSatisfied(subtask.id)) {
      if (Date.now() - startTime > MAX_DEPENDENCY_WAIT_MS) {
        logger.error(`Timeout waiting for dependencies of task ${subtask.id}`);
        const errorResult = {
          taskId: subtask.id,
          success: false,
          error: 'Timeout waiting for task dependencies',
        };
        results.set(subtask.id, errorResult);
        this.taskManager.storeResult(errorResult);
        return;
      }
      logger.debug(`Waiting for dependencies of task ${subtask.id}...`);
      await new Promise(resolve => setTimeout(resolve, TASK_DEPENDENCY_POLL_INTERVAL_MS));
    }

    // Select appropriate agent
    let agent = await this.selectAgent(subtask);
    
    // If no agent found and dynamic agents are enabled, try to create one
    if (!agent && this.dynamicAgentConfig.enabled && this.agentFactory) {
      logger.info(`No suitable agent found for task ${subtask.id}, attempting to create specialized agent`);
      try {
        agent = await this.createAgentForTask(subtask.description, subtask);
        if (agent) {
          logger.info(`Created and selected new agent ${agent.id} for task ${subtask.id}`);
        }
      } catch (error) {
        logger.warn(`Failed to create agent for task ${subtask.id}:`, error);
      }
    }

    if (!agent) {
      logger.error(`No suitable agent found for task ${subtask.id}`);
      const errorResult = {
        taskId: subtask.id,
        success: false,
        error: 'No suitable agent found',
      };
      results.set(subtask.id, errorResult);
      this.taskManager.storeResult(errorResult);
      return;
    }

    // Assign and execute
    this.taskManager.assignTask(subtask.id, agent.id);
    this.taskManager.updateTaskStatus(subtask.id, 'in_progress');
    this.agentRegistry.setAgentAvailability(agent.id, false);

    logger.info(`Executing task ${subtask.id} with agent ${agent.id}`);

    try {
      const result = await agent.execute(subtask);
      results.set(subtask.id, result);
      this.taskManager.storeResult(result);

      // Publish completion message
      this.messageQueue.publish({
        id: uuidv4(),
        type: result.success ? 'task_completed' : 'task_failed',
        payload: result,
        timestamp: new Date(),
        sourceAgentId: agent.id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error executing task ${subtask.id}:`, error);
      const errorResult = {
        taskId: subtask.id,
        success: false,
        error: errorMessage,
      };
      results.set(subtask.id, errorResult);
      this.taskManager.storeResult(errorResult);
    } finally {
      this.agentRegistry.setAgentAvailability(agent.id, true);
    }
  }

  /**
   * Select appropriate agent for a task
   */
  private async selectAgent(task: Task): Promise<Agent | undefined> {
    // First, try to find agents with all required capabilities
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const candidates = this.agentRegistry.findAgentsByCapability(task.requiredCapabilities);
      if (candidates.length > 0) {
        // Use LLM to select best agent if available
        const llmHelpers = this.getLLMHelpers();
        if (this.llm.isAvailable() && llmHelpers && candidates.length > 1) {
          try {
            // Add timeout to prevent hanging
            const selectPromise = llmHelpers.selectAgents(
              task.description,
              candidates.map(a => {
                // BaseAgent has getMetadata, but Agent interface doesn't require it
                if ('getMetadata' in a && typeof a.getMetadata === 'function') {
                  return a.getMetadata();
                }
                // Fallback for agents without getMetadata
                return {
                  id: a.id,
                  name: a.name,
                  description: a.description,
                  capabilities: a.capabilities,
                };
              })
            );
            const timeoutPromise = new Promise<string[]>((resolve) => 
              setTimeout(() => resolve([candidates[0].id]), 5000)
            );
            const selected = await Promise.race([selectPromise, timeoutPromise]);
            if (selected.length > 0) {
              return candidates.find(a => a.id === selected[0]);
            }
          } catch (error) {
            logger.warn('Agent selection failed, using first candidate', error);
          }
        }
        return candidates[0]; // Return first candidate
      }
    }

    // Fallback: find agents with any matching capability
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const candidates = this.agentRegistry.findAgentsWithAnyCapability(task.requiredCapabilities);
      if (candidates.length > 0) {
        return candidates[0];
      }
    }

    // Last resort: return first available agent
    const available = this.agentRegistry.getAvailableAgents();
    return available.length > 0 ? available[0] : undefined;
  }

  /**
   * Synthesize results from subtasks
   */
  private async synthesizeResults(
    task: Task,
    results: Map<string, TaskResult>
  ): Promise<TaskResult> {
    // Handle empty results - this can happen if all subtasks failed to execute
    if (results.size === 0) {
      logger.warn(`No results to synthesize for task ${task.id} - all subtasks may have failed`);
      return this.createFailureResult(task.id, 'No subtasks were executed successfully');
    }

    const allSuccessful = Array.from(results.values()).every(r => r.success);
    
    if (!allSuccessful) {
      const failures = Array.from(results.values()).filter(r => !r.success);
      logger.warn(`Task ${task.id} completed with ${failures.length} failures`);
    }

    // Combine all result data
    const combinedData = {
      subtasks: Array.from(results.entries()).map(([taskId, result]) => ({
        taskId,
        success: result.success,
        data: result.data,
        error: result.error,
      })),
      summary: {
        total: results.size,
        successful: Array.from(results.values()).filter(r => r.success).length,
        failed: Array.from(results.values()).filter(r => !r.success).length,
      },
    };

    return this.createSuccessResult(task.id, combinedData, {
      allSuccessful,
      subtaskCount: results.size,
    });
  }

  /**
   * Determine execution order of tasks
   */
  private determineExecutionOrder(tasks: Task[]): string[] {
    // Simple topological sort based on dependencies
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) {
        logger.warn(`Circular dependency detected involving task ${taskId}`);
        return;
      }

      visiting.add(taskId);
      const task = this.taskManager.getTask(taskId);
      
      if (task?.dependencies) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return order;
  }

  /**
   * Topological sort helper
   */
  private topologicalSort(
    tasks: Task[],
    dependencies: Map<string, string[]>
  ): string[] {
    return this.taskManager.buildDecomposition(tasks[0]?.parentTaskId || tasks[0]?.id || '')
      .estimatedExecutionOrder;
  }

  /**
   * Handle task completed message
   */
  private handleTaskCompleted(message: Message): void {
    logger.debug(`Task completed: ${message.payload}`);
  }

  /**
   * Handle task failed message
   */
  private handleTaskFailed(message: Message): void {
    logger.warn(`Task failed: ${message.payload}`);
  }

  /**
   * Determine if a specialized agent should be created for a task
   */
  private async shouldCreateAgent(
    taskDescription: string,
    parentTask?: Task
  ): Promise<boolean> {
    // Check if dynamic agents are enabled
    if (!this.dynamicAgentConfig.enabled || !this.agentFactory) {
      return false;
    }

    // Check if we've reached the max number of dynamic agents
    if (
      this.dynamicAgentConfig.maxDynamicAgents &&
      this.createdAgentsCount >= this.dynamicAgentConfig.maxDynamicAgents
    ) {
      logger.debug(`Reached max dynamic agents limit (${this.dynamicAgentConfig.maxDynamicAgents})`);
      return false;
    }

    // Get existing agents
    const existingAgents = this.agentRegistry.getAvailableAgents();
    const agentMetadata = existingAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      capabilities: agent.capabilities,
      description: agent.description,
    }));

    // Use LLM to detect if agent creation would be beneficial
    const llmHelpers = this.getLLMHelpers();
    if (this.llm.isAvailable() && llmHelpers) {
      try {
        const detectionPromise = llmHelpers.detectMissingAgentCapability(
          parentTask?.description || taskDescription,
          agentMetadata,
          taskDescription
        );
        const timeoutPromise = new Promise<{
          shouldCreate: boolean;
          missingCapabilities: string[];
          rationale: string;
          complexity: 'low' | 'medium' | 'high';
        }>((resolve) =>
          setTimeout(
            () => resolve({ shouldCreate: false, missingCapabilities: [], rationale: 'Timeout', complexity: 'medium' }),
            5000
          )
        );
        const detection = await Promise.race([detectionPromise, timeoutPromise]);

        // Check complexity threshold
        const complexityScores = { low: 0.3, medium: 0.5, high: 0.7 };
        const threshold = this.dynamicAgentConfig.agentCreationThreshold || 0.5;
        const complexityScore = complexityScores[detection.complexity] || 0.5;

        if (detection.shouldCreate && complexityScore >= threshold) {
          logger.info(
            `Agent creation recommended: ${detection.rationale} (complexity: ${detection.complexity})`
          );
          return true;
        }

        logger.debug(`Agent creation not recommended: ${detection.rationale}`);
        return false;
      } catch (error) {
        logger.warn('Error during agent creation detection:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Create a specialized agent for a task
   */
  private async createAgentForTask(
    taskDescription: string,
    parentTask?: Task
  ): Promise<Agent | null> {
    if (!this.dynamicAgentConfig.enabled || !this.agentFactory) {
      return null;
    }

    // Check if we've reached the max number of dynamic agents
    if (
      this.dynamicAgentConfig.maxDynamicAgents &&
      this.createdAgentsCount >= this.dynamicAgentConfig.maxDynamicAgents
    ) {
      logger.warn(`Cannot create more agents: reached limit of ${this.dynamicAgentConfig.maxDynamicAgents}`);
      return null;
    }

    try {
      // Get existing agents for context
      const existingAgents = this.agentRegistry.getAvailableAgents();
      const agentMetadata = existingAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        capabilities: agent.capabilities,
        description: agent.description,
      }));

      // Detect missing capabilities
      const llmHelpers = this.getLLMHelpers();
      if (!this.llm.isAvailable() || !llmHelpers) {
        logger.warn('LLM not available for agent creation');
        return null;
      }

      const detectionPromise = llmHelpers.detectMissingAgentCapability(
        parentTask?.description || taskDescription,
        agentMetadata,
        taskDescription
      );
      const timeoutPromise = new Promise<{
        shouldCreate: boolean;
        missingCapabilities: string[];
        rationale: string;
        complexity: 'low' | 'medium' | 'high';
      }>((resolve) =>
        setTimeout(
          () => resolve({ shouldCreate: false, missingCapabilities: [], rationale: 'Timeout', complexity: 'medium' }),
          5000
        )
      );
      const detection = await Promise.race([detectionPromise, timeoutPromise]);

      if (!detection.shouldCreate || detection.missingCapabilities.length === 0) {
        logger.debug(`Agent creation not needed: ${detection.rationale}`);
        return null;
      }

      // Generate agent specification
      const specPromise = llmHelpers.generateAgentSpecification(
        taskDescription,
        detection.missingCapabilities,
        agentMetadata
      );
      const specTimeoutPromise = new Promise<{
        name: string;
        description: string;
        capabilities: string[];
        behavior: any;
        requiredMCPServers?: string[];
        metadata?: Record<string, unknown>;
      }>((resolve) =>
        setTimeout(
          () => resolve({
            name: 'Fallback Agent',
            description: 'A fallback agent',
            capabilities: detection.missingCapabilities,
            behavior: { executionStrategy: 'llm_direct' },
          }),
          10000
        )
      );
      const specification = await Promise.race([specPromise, specTimeoutPromise]);

      // Determine persistence options from task metadata or use defaults
      const persistenceOptions: AgentPersistenceOptions =
        (parentTask?.metadata?.agentPersistence as AgentPersistenceOptions) ||
        this.dynamicAgentConfig.defaultPersistence || {
          persist: false,
          persistConfig: false,
          persistCode: false,
        };

      // Create the agent
      const agent = await this.agentFactory.createDynamicAgent(
        specification,
        persistenceOptions
      );

      this.createdAgentsCount++;
      logger.info(
        `Created dynamic agent: ${agent.name} (${agent.id}) for task: ${taskDescription.substring(0, 50)}`
      );

      return agent;
    } catch (error) {
      logger.error(`Failed to create agent for task: ${taskDescription}`, error);
      return null;
    }
  }

  /**
   * Get the agent factory (for external access if needed)
   */
  getAgentFactory(): AgentFactory | undefined {
    return this.agentFactory;
  }

  /**
   * Get dynamic agent configuration
   */
  getDynamicAgentConfig(): DynamicAgentConfig {
    return this.dynamicAgentConfig;
  }
}

