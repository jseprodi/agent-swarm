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
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class Orchestrator extends BaseAgent {
  private taskManager: TaskManager;
  private messageQueue: MessageQueue;
  private agentRegistry: AgentRegistry;
  private mcpManager: MCPManager;
  private mcpDiscoveryAgent: MCPDiscoveryAgent;
  private isProcessing: boolean = false;

  constructor(
    taskManager: TaskManager,
    messageQueue: MessageQueue,
    agentRegistry: AgentRegistry,
    mcpManager: MCPManager,
    llm?: ILLMProvider
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
        const requiredCapabilities = await llmHelpers.determineRequiredMCPServers(task.description);
        if (requiredCapabilities.length > 0) {
          // Create a discovery task
          const discoveryTask = this.taskManager.createTask(
            `Discover MCP servers for capabilities: ${requiredCapabilities.join(', ')}`,
            task.id,
            ['mcp_discovery'],
            undefined,
            { requiredCapabilities }
          );

          const discoveryResult = await this.mcpDiscoveryAgent.execute(discoveryTask);
          
          if (discoveryResult.success && discoveryResult.data) {
            const data = discoveryResult.data as { connectedServers: string[] };
            task.requiredMCPServers = data.connectedServers;
            logger.info(`Discovered and connected ${data.connectedServers.length} MCP servers`);
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
        const decomposition = await llmHelpers.decomposeTask(
          task.description,
          agentMetadata.map(a => a.id)
        );

        logger.info(`LLM decomposed task into ${decomposition.subtasks.length} subtasks`);

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
   * Execute subtasks in order
   */
  private async executeSubtasks(subtasks: Task[]): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();

    // Sort by execution order from decomposition
    const taskOrder = this.determineExecutionOrder(subtasks);

    for (const taskId of taskOrder) {
      const subtask = this.taskManager.getTask(taskId);
      if (!subtask) continue;

      // Wait for dependencies
      while (!this.taskManager.areDependenciesSatisfied(subtask.id)) {
        logger.debug(`Waiting for dependencies of task ${subtask.id}...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Select appropriate agent
      const agent = this.selectAgent(subtask);
      if (!agent) {
        logger.error(`No suitable agent found for task ${subtask.id}`);
        const errorResult = {
          taskId: subtask.id,
          success: false,
          error: 'No suitable agent found',
        };
        results.set(subtask.id, errorResult);
        this.taskManager.storeResult(errorResult);
        continue;
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

    return results;
  }

  /**
   * Select appropriate agent for a task
   */
  private selectAgent(task: Task): Agent | undefined {
    // First, try to find agents with all required capabilities
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const candidates = this.agentRegistry.findAgentsByCapability(task.requiredCapabilities);
      if (candidates.length > 0) {
        // Use LLM to select best agent if available
        const llmHelpers = this.getLLMHelpers();
        if (this.llm.isAvailable() && llmHelpers && candidates.length > 1) {
          const selected = await llmHelpers.selectAgents(
            task.description,
            candidates.map(a => a.getMetadata())
          );
          if (selected.length > 0) {
            return candidates.find(a => a.id === selected[0]);
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
}

