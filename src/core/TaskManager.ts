/**
 * Task Manager for tracking task state, dependencies, and progress
 */

import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus, TaskResult, TaskDecomposition } from './types.js';
import logger from '../utils/logger.js';

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private results: Map<string, TaskResult> = new Map();
  private taskGraph: Map<string, Set<string>> = new Map(); // Task ID -> Set of dependent task IDs

  /**
   * Create a new task
   */
  createTask(
    description: string,
    parentTaskId?: string,
    requiredCapabilities?: string[],
    requiredMCPServers?: string[],
    metadata?: Record<string, unknown>,
    addParentToDependencies: boolean = true
  ): Task {
    const task: Task = {
      id: uuidv4(),
      description,
      status: 'pending',
      parentTaskId,
      requiredCapabilities,
      requiredMCPServers,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Automatically add parent task to dependencies if parentTaskId is provided and flag is true
    // Note: For Orchestrator subtasks, this should be false to avoid circular dependencies
    // (subtasks should execute independently, parent waits for them, not vice versa)
    if (parentTaskId && addParentToDependencies) {
      if (!task.dependencies) {
        task.dependencies = [];
      }
      if (!task.dependencies.includes(parentTaskId)) {
        task.dependencies.push(parentTaskId);
      }
    }

    this.tasks.set(task.id, task);

    logger.info(`Created task: ${task.id} - ${description}`);
    return task;
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get sub-tasks of a parent task
   */
  getSubTasks(parentTaskId: string): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.parentTaskId === parentTaskId
    );
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Attempted to update status of non-existent task: ${taskId}`);
      return;
    }

    task.status = status;
    task.updatedAt = new Date();

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      task.completedAt = new Date();
    }

    logger.debug(`Task ${taskId} status updated to: ${status}`);
  }

  /**
   * Assign task to an agent
   */
  assignTask(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Attempted to assign non-existent task: ${taskId}`);
      return;
    }

    task.assignedAgent = agentId;
    task.updatedAt = new Date();
    logger.info(`Task ${taskId} assigned to agent: ${agentId}`);
  }

  /**
   * Store task result
   */
  storeResult(result: TaskResult): void {
    this.results.set(result.taskId, result);
    
    const task = this.tasks.get(result.taskId);
    if (task) {
      task.updatedAt = new Date();
      if (result.success) {
        this.updateTaskStatus(result.taskId, 'completed');
      } else {
        this.updateTaskStatus(result.taskId, 'failed');
      }
    }

    logger.info(`Stored result for task ${result.taskId}: ${result.success ? 'success' : 'failed'}`);
  }

  /**
   * Get task result
   */
  getResult(taskId: string): TaskResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Check if task dependencies are satisfied
   */
  areDependenciesSatisfied(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    return task.dependencies.every(depId => {
      const depTask = this.tasks.get(depId);
      return depTask?.status === 'completed';
    });
  }

  /**
   * Get tasks that are ready to execute (dependencies satisfied)
   */
  getReadyTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(task => {
      return (
        task.status === 'pending' &&
        this.areDependenciesSatisfied(task.id) &&
        !task.assignedAgent
      );
    });
  }

  /**
   * Add dependency between tasks
   */
  addDependency(taskId: string, dependsOnTaskId: string): void {
    const task = this.tasks.get(taskId);
    const dependsOnTask = this.tasks.get(dependsOnTaskId);

    if (!task) {
      logger.warn(`Cannot add dependency: task ${taskId} does not exist`);
      return;
    }

    if (!dependsOnTask) {
      logger.warn(`Cannot add dependency: depends-on task ${dependsOnTaskId} does not exist`);
      return;
    }

    if (!task.dependencies) {
      task.dependencies = [];
    }

    if (!task.dependencies.includes(dependsOnTaskId)) {
      task.dependencies.push(dependsOnTaskId);
    }

    // Update task graph
    if (!this.taskGraph.has(dependsOnTaskId)) {
      this.taskGraph.set(dependsOnTaskId, new Set());
    }
    this.taskGraph.get(dependsOnTaskId)!.add(taskId);

    logger.debug(`Added dependency: ${taskId} depends on ${dependsOnTaskId}`);
  }

  /**
   * Decompose a task into subtasks
   */
  decomposeTask(
    parentTask: Task,
    subtasks: Array<{ description: string; requiredCapabilities?: string[]; requiredMCPServers?: string[] }>
  ): Task[] {
    const createdTasks: Task[] = [];

    for (const subtask of subtasks) {
      const task = this.createTask(
        subtask.description,
        parentTask.id,
        subtask.requiredCapabilities,
        subtask.requiredMCPServers
      );
      createdTasks.push(task);
    }

    logger.info(`Decomposed task ${parentTask.id} into ${createdTasks.length} subtasks`);
    return createdTasks;
  }

  /**
   * Build task decomposition structure
   */
  buildDecomposition(rootTaskId: string): TaskDecomposition {
    const rootTask = this.tasks.get(rootTaskId);
    if (!rootTask) {
      throw new Error(`Root task ${rootTaskId} not found`);
    }

    const tasks: Task[] = [rootTask];
    const dependencies = new Map<string, string[]>();
    const visited = new Set<string>();

    // Collect all tasks in the decomposition tree
    const collectTasks = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = this.tasks.get(taskId);
      if (!task) return;

      // Add subtasks
      const subTasks = this.getSubTasks(taskId);
      for (const subTask of subTasks) {
        tasks.push(subTask);
        collectTasks(subTask.id);
      }

      // Add dependencies
      if (task.dependencies) {
        dependencies.set(taskId, [...task.dependencies]);
        for (const depId of task.dependencies) {
          collectTasks(depId);
        }
      }
    };

    collectTasks(rootTaskId);

    // Calculate execution order (topological sort)
    const estimatedExecutionOrder = this.topologicalSort(tasks, dependencies);

    return {
      tasks,
      dependencies,
      estimatedExecutionOrder,
    };
  }

  /**
   * Topological sort to determine execution order
   */
  private topologicalSort(
    tasks: Task[],
    dependencies: Map<string, string[]>
  ): string[] {
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    // Initialize
    for (const task of tasks) {
      inDegree.set(task.id, 0);
      graph.set(task.id, []);
    }

    // Build graph and calculate in-degrees
    for (const task of tasks) {
      const deps = dependencies.get(task.id) || [];
      for (const depId of deps) {
        const currentInDegree = inDegree.get(task.id) || 0;
        inDegree.set(task.id, currentInDegree + 1);

        if (!graph.has(depId)) {
          graph.set(depId, []);
        }
        graph.get(depId)!.push(task.id);
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    for (const task of tasks) {
      if ((inDegree.get(task.id) || 0) === 0) {
        queue.push(task.id);
      }
    }

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      result.push(taskId);

      const neighbors = graph.get(taskId) || [];
      for (const neighborId of neighbors) {
        const currentInDegree = (inDegree.get(neighborId) || 0) - 1;
        inDegree.set(neighborId, currentInDegree);
        if (currentInDegree === 0) {
          queue.push(neighborId);
        }
      }
    }

    return result;
  }

  /**
   * Get task statistics
   */
  getStatistics(): {
    total: number;
    byStatus: Record<TaskStatus, number>;
    completed: number;
    failed: number;
    inProgress: number;
    pending: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }

    return {
      total: tasks.length,
      byStatus,
      completed: byStatus.completed,
      failed: byStatus.failed,
      inProgress: byStatus.in_progress,
      pending: byStatus.pending,
    };
  }

  /**
   * Mark task for recovery
   */
  markTaskForRecovery(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn(`Attempted to mark non-existent task for recovery: ${taskId}`);
      return;
    }

    if (task.status !== 'failed') {
      logger.warn(`Attempted to mark non-failed task for recovery: ${taskId}`);
      return;
    }

    // Add recovery metadata
    if (!task.metadata) {
      task.metadata = {};
    }
    task.metadata.recoverable = true;
    task.metadata.recoveryAttempts = (task.metadata.recoveryAttempts as number || 0) + 1;
    task.status = 'pending'; // Reset to pending for retry

    logger.info(`Task ${taskId} marked for recovery (attempt ${task.metadata.recoveryAttempts})`);
  }

  /**
   * Get recoverable tasks
   */
  getRecoverableTasks(): Task[] {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'failed' && (task.metadata?.recoverable === true || task.metadata?.recoveryAttempts)
    );
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.results.clear();
    this.taskGraph.clear();
    logger.info('Task manager cleared');
  }
}

