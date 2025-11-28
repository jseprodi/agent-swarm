/**
 * Statistics routes
 */

import { Router, Request, Response } from 'express';
import { Swarm } from '../../../src/index.js';
import logger from '../../../src/utils/logger.js';

export function statsRoutes(getSwarm: () => Swarm): Router {
  const router = Router();

  // Get system statistics
  router.get('/', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const taskManager = swarm.getTaskManager();
      const agentRegistry = swarm.getAgentRegistry();
      const mcpManager = swarm.getMCPManager();

      const taskStats = taskManager.getStatistics();
      const agents = agentRegistry.getAllAgents();
      const mcpServers = mcpManager.getRegistry().getAllServers();
      const connectedServers = mcpManager.getRegistry().getConnectedServers();

      res.json({
        tasks: taskStats,
        agents: {
          total: agents.length,
          available: agentRegistry.getAvailableAgents().length,
        },
        mcpServers: {
          total: mcpServers.length,
          connected: connectedServers.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting statistics:', error);
      res.status(500).json({
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

