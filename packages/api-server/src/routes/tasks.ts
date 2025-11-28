/**
 * Task management routes
 */

import { Router, Request, Response } from 'express';
import { Swarm } from '../../../src/index.js';
import type { Task, TaskResult } from '../../../src/core/types.js';
import logger from '../../../src/utils/logger.js';

export function taskRoutes(getSwarm: () => Swarm): Router {
  const router = Router();

  // Create new task
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { description, metadata } = req.body;

      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: 'Task description is required' });
      }

      const swarm = getSwarm();
      const result = await swarm.execute(description, metadata);

      res.status(201).json(result);
    } catch (error) {
      logger.error('Error creating task:', error);
      res.status(500).json({
        error: 'Failed to create task',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // List all tasks
  router.get('/', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const { status, agentId } = req.query;

      let tasks = taskManager.getAllTasks();

      // Apply filters
      if (status) {
        tasks = tasks.filter(t => t.status === status);
      }

      if (agentId) {
        tasks = tasks.filter(t => t.assignedAgent === agentId);
      }

      // Sort by creation date (newest first)
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({ tasks, count: tasks.length });
    } catch (error) {
      logger.error('Error listing tasks:', error);
      res.status(500).json({
        error: 'Failed to list tasks',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get task details
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const task = taskManager.getTask(req.params.id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get subtasks if any
      const subtasks = taskManager.getSubTasks(task.id);

      // Get result if available
      const result = taskManager.getResult(task.id);

      res.json({
        task,
        subtasks,
        result,
      });
    } catch (error) {
      logger.error('Error getting task:', error);
      res.status(500).json({
        error: 'Failed to get task',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get task result
  router.get('/:id/result', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const result = taskManager.getResult(req.params.id);

      if (!result) {
        return res.status(404).json({ error: 'Task result not found' });
      }

      res.json(result);
    } catch (error) {
      logger.error('Error getting task result:', error);
      res.status(500).json({
        error: 'Failed to get task result',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Cancel task
  router.post('/:id/cancel', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const task = taskManager.getTask(req.params.id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return res.status(400).json({ error: `Task is already ${task.status}` });
      }

      taskManager.updateTaskStatus(req.params.id, 'cancelled');

      res.json({ message: 'Task cancelled', taskId: req.params.id });
    } catch (error) {
      logger.error('Error cancelling task:', error);
      res.status(500).json({
        error: 'Failed to cancel task',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

