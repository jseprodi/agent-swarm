/**
 * Agent management routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Swarm } from '../../../src/index.js';
import logger from '../../../src/utils/logger.js';
import { validateParams } from '../middleware/validation.js';

export function agentRoutes(getSwarm: () => Swarm): Router {
  const router = Router();

  // List all agents
  router.get('/', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const agentRegistry = swarm.getAgentRegistry();
      const agents = agentRegistry.getAllAgents().map(agent => agent.getMetadata());

      res.json({ agents, count: agents.length });
    } catch (error) {
      logger.error('Error listing agents:', error);
      res.status(500).json({
        error: 'Failed to list agents',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get agent details
  router.get('/:id', validateParams(z.object({
    id: z.string().min(1),
  })), (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const agentRegistry = swarm.getAgentRegistry();
      const metadata = agentRegistry.getAgentMetadata(req.params.id);

      if (!metadata) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Get registration info for availability
      const registration = agentRegistry
        .getAllRegistrations()
        .find(r => r.agentId === req.params.id);

      res.json({
        ...metadata,
        isAvailable: registration?.isAvailable ?? true,
      });
    } catch (error) {
      logger.error('Error getting agent:', error);
      res.status(500).json({
        error: 'Failed to get agent',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get agent status
  router.get('/:id/status', validateParams(z.object({
    id: z.string().min(1),
  })), (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const agentRegistry = swarm.getAgentRegistry();
      const registration = agentRegistry
        .getAllRegistrations()
        .find(r => r.agentId === req.params.id);

      if (!registration) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Get tasks assigned to this agent
      const taskManager = swarm.getTaskManager();
      const tasks = taskManager
        .getAllTasks()
        .filter(t => t.assignedAgent === req.params.id);

      res.json({
        agentId: req.params.id,
        isAvailable: registration.isAvailable,
        capabilities: registration.capabilities,
        mcpServersUsed: registration.mcpServersUsed || [],
        activeTasks: tasks.filter(t => t.status === 'in_progress').length,
        totalTasks: tasks.length,
      });
    } catch (error) {
      logger.error('Error getting agent status:', error);
      res.status(500).json({
        error: 'Failed to get agent status',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get tasks assigned to agent
  router.get('/:id/tasks', validateParams(z.object({
    id: z.string().min(1),
  })), (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const tasks = taskManager
        .getAllTasks()
        .filter(t => t.assignedAgent === req.params.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({ tasks, count: tasks.length });
    } catch (error) {
      logger.error('Error getting agent tasks:', error);
      res.status(500).json({
        error: 'Failed to get agent tasks',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

