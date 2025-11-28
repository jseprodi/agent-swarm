/**
 * TaskManager unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from './TaskManager.js';
import type { TaskStatus, TaskResult } from './types.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('TaskManager', () => {
  let taskManager: TaskManager;

  beforeEach(() => {
    taskManager = new TaskManager();
  });

  describe('createTask', () => {
    it('should create a task with minimal parameters', () => {
      const task = taskManager.createTask('Test task');
      
      expect(task).toBeDefined();
      expect(task.description).toBe('Test task');
      expect(task.status).toBe('pending');
      expect(task.id).toBeDefined();
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a task with all parameters', () => {
      const parentTask = taskManager.createTask('Parent task');
      const task = taskManager.createTask(
        'Child task',
        parentTask.id,
        ['code_generation'],
        ['file-server'],
        { priority: 'high' }
      );
      
      expect(task.parentTaskId).toBe(parentTask.id);
      expect(task.requiredCapabilities).toEqual(['code_generation']);
      expect(task.requiredMCPServers).toEqual(['file-server']);
      expect(task.metadata).toEqual({ priority: 'high' });
      expect(task.dependencies).toContain(parentTask.id);
    });

    it('should create task with parent task dependency', () => {
      const parentTask = taskManager.createTask('Parent');
      const childTask = taskManager.createTask('Child', parentTask.id);
      
      expect(childTask.parentTaskId).toBe(parentTask.id);
      expect(childTask.dependencies).toContain(parentTask.id);
    });
  });

  describe('getTask', () => {
    it('should retrieve a task by ID', () => {
      const task = taskManager.createTask('Test task');
      const retrieved = taskManager.getTask(task.id);
      
      expect(retrieved).toEqual(task);
    });

    it('should return undefined for non-existent task', () => {
      const retrieved = taskManager.getTask('non-existent-id');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      const allTasks = taskManager.getAllTasks();
      expect(allTasks).toHaveLength(2);
      expect(allTasks.map(t => t.id)).toContain(task1.id);
      expect(allTasks.map(t => t.id)).toContain(task2.id);
    });

    it('should return empty array when no tasks', () => {
      expect(taskManager.getAllTasks()).toHaveLength(0);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status', async () => {
      const task = taskManager.createTask('Test task');
      await new Promise(resolve => setTimeout(resolve, 10));
      taskManager.updateTaskStatus(task.id, 'in_progress');
      
      const updated = taskManager.getTask(task.id);
      expect(updated?.status).toBe('in_progress');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should set completedAt for terminal statuses', () => {
      const task = taskManager.createTask('Test task');
      
      taskManager.updateTaskStatus(task.id, 'completed');
      let updated = taskManager.getTask(task.id);
      expect(updated?.completedAt).toBeDefined();
      
      taskManager.updateTaskStatus(task.id, 'pending');
      taskManager.updateTaskStatus(task.id, 'failed');
      updated = taskManager.getTask(task.id);
      expect(updated?.completedAt).toBeDefined();
      
      taskManager.updateTaskStatus(task.id, 'pending');
      taskManager.updateTaskStatus(task.id, 'cancelled');
      updated = taskManager.getTask(task.id);
      expect(updated?.completedAt).toBeDefined();
    });

    it('should not update status for non-existent task', () => {
      const initialCount = taskManager.getAllTasks().length;
      taskManager.updateTaskStatus('non-existent', 'completed');
      expect(taskManager.getAllTasks()).toHaveLength(initialCount);
    });
  });

  describe('assignTask', () => {
    it('should assign task to an agent', async () => {
      const task = taskManager.createTask('Test task');
      await new Promise(resolve => setTimeout(resolve, 10));
      taskManager.assignTask(task.id, 'agent-1');
      
      const updated = taskManager.getTask(task.id);
      expect(updated?.assignedAgent).toBe('agent-1');
      expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(task.updatedAt.getTime());
    });

    it('should not assign non-existent task', () => {
      taskManager.assignTask('non-existent', 'agent-1');
      // Should not throw, just log warning
    });
  });

  describe('storeResult', () => {
    it('should store successful result and update task status', () => {
      const task = taskManager.createTask('Test task');
      const result: TaskResult = {
        taskId: task.id,
        success: true,
        data: { result: 'Success' },
      };
      
      taskManager.storeResult(result);
      
      const storedResult = taskManager.getResult(task.id);
      expect(storedResult).toEqual(result);
      
      const updatedTask = taskManager.getTask(task.id);
      expect(updatedTask?.status).toBe('completed');
    });

    it('should store failed result and update task status', () => {
      const task = taskManager.createTask('Test task');
      const result: TaskResult = {
        taskId: task.id,
        success: false,
        error: 'Task failed',
      };
      
      taskManager.storeResult(result);
      
      const storedResult = taskManager.getResult(task.id);
      expect(storedResult).toEqual(result);
      
      const updatedTask = taskManager.getTask(task.id);
      expect(updatedTask?.status).toBe('failed');
    });

    it('should update task timestamp when storing result', async () => {
      const task = taskManager.createTask('Test task');
      const originalTime = task.updatedAt.getTime();
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result: TaskResult = {
        taskId: task.id,
        success: true,
        data: {},
      };
      taskManager.storeResult(result);
      
      const updatedTask = taskManager.getTask(task.id);
      expect(updatedTask?.updatedAt.getTime()).toBeGreaterThan(originalTime);
    });
  });

  describe('getResult', () => {
    it('should retrieve stored result', () => {
      const task = taskManager.createTask('Test task');
      const result: TaskResult = {
        taskId: task.id,
        success: true,
        data: { result: 'Success' },
      };
      
      taskManager.storeResult(result);
      const retrieved = taskManager.getResult(task.id);
      expect(retrieved).toEqual(result);
    });

    it('should return undefined for non-existent result', () => {
      const task = taskManager.createTask('Test task');
      const retrieved = taskManager.getResult(task.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getTasksByStatus', () => {
    it('should filter tasks by status', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      const task3 = taskManager.createTask('Task 3');
      
      taskManager.updateTaskStatus(task1.id, 'completed');
      taskManager.updateTaskStatus(task2.id, 'in_progress');
      
      const completed = taskManager.getTasksByStatus('completed');
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe(task1.id);
      
      const inProgress = taskManager.getTasksByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].id).toBe(task2.id);
      
      const pending = taskManager.getTasksByStatus('pending');
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(task3.id);
    });

    it('should return empty array when no tasks match status', () => {
      taskManager.createTask('Task 1');
      const failed = taskManager.getTasksByStatus('failed');
      expect(failed).toHaveLength(0);
    });
  });

  describe('getSubTasks', () => {
    it('should return subtasks of a parent', () => {
      const parent = taskManager.createTask('Parent');
      const child1 = taskManager.createTask('Child 1', parent.id);
      const child2 = taskManager.createTask('Child 2', parent.id);
      const unrelated = taskManager.createTask('Unrelated');
      
      const subtasks = taskManager.getSubTasks(parent.id);
      expect(subtasks).toHaveLength(2);
      expect(subtasks.map(t => t.id)).toContain(child1.id);
      expect(subtasks.map(t => t.id)).toContain(child2.id);
      expect(subtasks.map(t => t.id)).not.toContain(unrelated.id);
    });

    it('should return empty array when no subtasks', () => {
      const parent = taskManager.createTask('Parent');
      const subtasks = taskManager.getSubTasks(parent.id);
      expect(subtasks).toHaveLength(0);
    });
  });

  describe('addDependency', () => {
    it('should add dependency between tasks', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.addDependency(task2.id, task1.id);
      
      const task2Retrieved = taskManager.getTask(task2.id);
      expect(task2Retrieved?.dependencies).toContain(task1.id);
    });

    it('should not add duplicate dependencies', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.addDependency(task2.id, task1.id);
      taskManager.addDependency(task2.id, task1.id);
      
      const task2Retrieved = taskManager.getTask(task2.id);
      expect(task2Retrieved?.dependencies?.filter(id => id === task1.id)).toHaveLength(1);
    });

    it('should not add dependency if task does not exist', () => {
      const task1 = taskManager.createTask('Task 1');
      taskManager.addDependency('non-existent', task1.id);
      // Should not throw, just log warning
    });

    it('should not add dependency if depends-on task does not exist', () => {
      const task1 = taskManager.createTask('Task 1');
      taskManager.addDependency(task1.id, 'non-existent');
      // Should not throw, just log warning
    });
  });

  describe('areDependenciesSatisfied', () => {
    it('should return true when task has no dependencies', () => {
      const task = taskManager.createTask('Task');
      expect(taskManager.areDependenciesSatisfied(task.id)).toBe(true);
    });

    it('should return false when dependencies are not completed', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.addDependency(task2.id, task1.id);
      
      expect(taskManager.areDependenciesSatisfied(task2.id)).toBe(false);
    });

    it('should return true when all dependencies are completed', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.addDependency(task2.id, task1.id);
      taskManager.updateTaskStatus(task1.id, 'completed');
      
      expect(taskManager.areDependenciesSatisfied(task2.id)).toBe(true);
    });

    it('should return false when any dependency is not completed', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      const task3 = taskManager.createTask('Task 3');
      
      taskManager.addDependency(task3.id, task1.id);
      taskManager.addDependency(task3.id, task2.id);
      
      taskManager.updateTaskStatus(task1.id, 'completed');
      // task2 is still pending
      
      expect(taskManager.areDependenciesSatisfied(task3.id)).toBe(false);
    });

    it('should return true for non-existent task', () => {
      expect(taskManager.areDependenciesSatisfied('non-existent')).toBe(true);
    });
  });

  describe('getReadyTasks', () => {
    it('should return tasks ready to execute', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      const task3 = taskManager.createTask('Task 3');
      
      // task1 has dependency on task2
      taskManager.addDependency(task1.id, task2.id);
      taskManager.updateTaskStatus(task2.id, 'completed');
      
      // task3 is assigned
      taskManager.assignTask(task3.id, 'agent-1');
      
      const ready = taskManager.getReadyTasks();
      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(task1.id);
    });

    it('should not return tasks with unsatisfied dependencies', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.addDependency(task1.id, task2.id);
      // task2 is not completed
      
      const ready = taskManager.getReadyTasks();
      expect(ready.map(t => t.id)).not.toContain(task1.id);
    });

    it('should not return assigned tasks', () => {
      const task = taskManager.createTask('Task');
      taskManager.assignTask(task.id, 'agent-1');
      
      const ready = taskManager.getReadyTasks();
      expect(ready.map(t => t.id)).not.toContain(task.id);
    });
  });

  describe('decomposeTask', () => {
    it('should decompose task into subtasks', () => {
      const parent = taskManager.createTask('Parent task');
      const subtasks = taskManager.decomposeTask(parent, [
        { description: 'Subtask 1', requiredCapabilities: ['code'] },
        { description: 'Subtask 2', requiredMCPServers: ['file-server'] },
      ]);
      
      expect(subtasks).toHaveLength(2);
      expect(subtasks[0].parentTaskId).toBe(parent.id);
      expect(subtasks[0].requiredCapabilities).toEqual(['code']);
      expect(subtasks[1].requiredMCPServers).toEqual(['file-server']);
    });

    it('should create subtasks with dependencies on parent', () => {
      const parent = taskManager.createTask('Parent');
      const subtasks = taskManager.decomposeTask(parent, [
        { description: 'Subtask 1' },
      ]);
      
      expect(subtasks[0].dependencies).toContain(parent.id);
    });
  });

  describe('buildDecomposition', () => {
    it('should build decomposition structure', () => {
      const root = taskManager.createTask('Root');
      const child1 = taskManager.createTask('Child 1', root.id);
      const child2 = taskManager.createTask('Child 2', root.id);
      const grandchild = taskManager.createTask('Grandchild', child1.id);
      
      const decomposition = taskManager.buildDecomposition(root.id);
      
      expect(decomposition.tasks).toHaveLength(4);
      expect(decomposition.tasks.map(t => t.id)).toContain(root.id);
      expect(decomposition.tasks.map(t => t.id)).toContain(child1.id);
      expect(decomposition.tasks.map(t => t.id)).toContain(child2.id);
      expect(decomposition.tasks.map(t => t.id)).toContain(grandchild.id);
      expect(decomposition.estimatedExecutionOrder).toContain(root.id);
    });

    it('should throw error for non-existent root task', () => {
      expect(() => {
        taskManager.buildDecomposition('non-existent');
      }).toThrow('Root task non-existent not found');
    });

    it('should handle tasks with dependencies', () => {
      const root = taskManager.createTask('Root');
      const task1 = taskManager.createTask('Task 1', root.id);
      const task2 = taskManager.createTask('Task 2', root.id);
      
      taskManager.addDependency(task2.id, task1.id);
      
      const decomposition = taskManager.buildDecomposition(root.id);
      expect(decomposition.dependencies.has(task2.id)).toBe(true);
      expect(decomposition.dependencies.get(task2.id)).toContain(task1.id);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      const task3 = taskManager.createTask('Task 3');
      const task4 = taskManager.createTask('Task 4');
      
      taskManager.updateTaskStatus(task2.id, 'completed');
      taskManager.updateTaskStatus(task3.id, 'in_progress');
      taskManager.updateTaskStatus(task4.id, 'failed');
      
      const stats = taskManager.getStatistics();
      expect(stats.total).toBe(4);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.inProgress).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byStatus.failed).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.cancelled).toBe(0);
    });

    it('should return zero statistics for empty manager', () => {
      const stats = taskManager.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all tasks, results, and graph', () => {
      const task1 = taskManager.createTask('Task 1');
      const task2 = taskManager.createTask('Task 2');
      
      taskManager.storeResult({
        taskId: task1.id,
        success: true,
        data: {},
      });
      taskManager.addDependency(task2.id, task1.id);
      
      taskManager.clear();
      
      expect(taskManager.getAllTasks()).toHaveLength(0);
      expect(taskManager.getResult(task1.id)).toBeUndefined();
      const stats = taskManager.getStatistics();
      expect(stats.total).toBe(0);
    });
  });
});

