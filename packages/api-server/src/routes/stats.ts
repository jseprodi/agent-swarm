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

  // Get all metrics
  router.get('/metrics', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      // Access metrics collector if available
      // Note: This requires Swarm to expose metrics collector
      const metricsCollector = (swarm as any).getMetricsCollector?.();
      
      if (!metricsCollector) {
        return res.status(503).json({
          error: 'Metrics not available',
          message: 'Metrics collector not initialized',
        });
      }

      const allMetrics = metricsCollector.getAllMetrics();
      res.json(allMetrics);
    } catch (error) {
      logger.error('Error getting metrics:', error);
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get agent-specific metrics
  router.get('/metrics/agents', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const metricsCollector = (swarm as any).getMetricsCollector?.();
      
      if (!metricsCollector) {
        return res.status(503).json({
          error: 'Metrics not available',
          message: 'Metrics collector not initialized',
        });
      }

      const allMetrics = metricsCollector.getAllMetrics();
      const agentMetrics = {
        counters: allMetrics.counters.filter((m: any) => m.name.startsWith('agent_')),
        timers: allMetrics.timers.filter((m: any) => m.name.startsWith('agent_')),
      };

      res.json(agentMetrics);
    } catch (error) {
      logger.error('Error getting agent metrics:', error);
      res.status(500).json({
        error: 'Failed to get agent metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get task performance metrics
  router.get('/metrics/tasks', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const metricsCollector = (swarm as any).getMetricsCollector?.();
      
      if (!metricsCollector) {
        return res.status(503).json({
          error: 'Metrics not available',
          message: 'Metrics collector not initialized',
        });
      }

      const allMetrics = metricsCollector.getAllMetrics();
      const taskMetrics = {
        counters: allMetrics.counters.filter((m: any) => m.name.includes('task')),
        timers: allMetrics.timers.filter((m: any) => m.name.includes('task') || m.name.includes('orchestrator')),
      };

      res.json(taskMetrics);
    } catch (error) {
      logger.error('Error getting task metrics:', error);
      res.status(500).json({
        error: 'Failed to get task metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get LLM usage metrics
  router.get('/metrics/llm', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const metricsCollector = (swarm as any).getMetricsCollector?.();
      
      if (!metricsCollector) {
        return res.status(503).json({
          error: 'Metrics not available',
          message: 'Metrics collector not initialized',
        });
      }

      // LLM metrics would be tracked separately
      // For now, return empty or placeholder
      res.json({
        message: 'LLM metrics endpoint - implementation pending',
        counters: [],
        timers: [],
      });
    } catch (error) {
      logger.error('Error getting LLM metrics:', error);
      res.status(500).json({
        error: 'Failed to get LLM metrics',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Enhanced health check
  router.get('/health', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const healthMonitor = (swarm as any).getHealthMonitor?.();
      
      if (healthMonitor) {
        const healthReport = healthMonitor.performHealthCheck();
        const statusCode = healthReport.status === 'healthy' ? 200 : healthReport.status === 'degraded' ? 200 : 503;
        return res.status(statusCode).json(healthReport);
      }

      // Fallback to basic health check
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error performing health check:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}

