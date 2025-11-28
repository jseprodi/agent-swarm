/**
 * MCP server management routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Swarm } from '../../../src/index.js';
import logger from '../../../src/utils/logger.js';
import { validateBody, validateParams, validationSchemas } from '../middleware/validation.js';

export function mcpRoutes(getSwarm: () => Swarm): Router {
  const router = Router();

  // List all MCP servers
  router.get('/servers', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const mcpManager = swarm.getMCPManager();
      const servers = mcpManager.getRegistry().getAllServers();

      res.json({ servers, count: servers.length });
    } catch (error) {
      logger.error('Error listing MCP servers:', error);
      res.status(500).json({
        error: 'Failed to list MCP servers',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get server details
  router.get('/servers/:id', validateParams(z.object({
    id: z.string().min(1),
  })), (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const mcpManager = swarm.getMCPManager();
      const metadata = mcpManager.getServerMetadata(req.params.id);

      if (!metadata) {
        return res.status(404).json({ error: 'MCP server not found' });
      }

      // Get client if connected
      const client = mcpManager.getClient(req.params.id);
      const capabilities = client?.getCapabilities() || metadata.capabilities;

      res.json({
        ...metadata,
        capabilities,
      });
    } catch (error) {
      logger.error('Error getting MCP server:', error);
      res.status(500).json({
        error: 'Failed to get MCP server',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Connect to server
  router.post('/servers/connect', validateBody(validationSchemas.connectServer), async (req: Request, res: Response) => {
    try {
      const { serverId } = req.body;

      const swarm = getSwarm();
      const mcpManager = swarm.getMCPManager();
      const client = await mcpManager.connectServer(serverId);

      const capabilities = client.getCapabilities();

      res.json({
        message: 'Connected to MCP server',
        serverId,
        capabilities,
      });
    } catch (error) {
      logger.error('Error connecting to MCP server:', error);
      res.status(500).json({
        error: 'Failed to connect to MCP server',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Disconnect server
  router.post('/servers/:id/disconnect', validateParams(z.object({
    id: z.string().min(1),
  })), async (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const mcpManager = swarm.getMCPManager();
      await mcpManager.disconnectServer(req.params.id);

      res.json({
        message: 'Disconnected from MCP server',
        serverId: req.params.id,
      });
    } catch (error) {
      logger.error('Error disconnecting MCP server:', error);
      res.status(500).json({
        error: 'Failed to disconnect MCP server',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Trigger discovery
  router.post('/servers/discover', validateBody(validationSchemas.discoverServers), async (req: Request, res: Response) => {
    try {
      const { capabilities, keywords } = req.body;

      const swarm = getSwarm();
      const orchestrator = swarm.getOrchestrator();
      const taskManager = swarm.getTaskManager();

      // Create a discovery task
      const task = taskManager.createTask(
        `Discover MCP servers${capabilities ? ` with capabilities: ${capabilities.join(', ')}` : ''}${keywords ? ` matching keywords: ${keywords.join(', ')}` : ''}`,
        undefined,
        ['mcp_discovery'],
        undefined,
        { capabilities, keywords }
      );

      // Execute discovery (this will be async)
      const result = await orchestrator.execute(task);

      res.json({
        message: 'Discovery triggered',
        taskId: task.id,
        result,
      });
    } catch (error) {
      logger.error('Error triggering discovery:', error);
      res.status(500).json({
        error: 'Failed to trigger discovery',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get server capabilities
  router.get('/servers/:id/capabilities', validateParams(z.object({
    id: z.string().min(1),
  })), (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const mcpManager = swarm.getMCPManager();
      const client = mcpManager.getClient(req.params.id);

      if (!client) {
        return res.status(404).json({ error: 'MCP server not connected' });
      }

      const capabilities = client.getCapabilities();

      res.json({
        serverId: req.params.id,
        capabilities,
      });
    } catch (error) {
      logger.error('Error getting server capabilities:', error);
      res.status(500).json({
        error: 'Failed to get server capabilities',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

