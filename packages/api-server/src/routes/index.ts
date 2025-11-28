/**
 * API Routes
 */

import { Express } from 'express';
import { Swarm } from '../../../src/index.js';
import { taskRoutes } from './tasks.js';
import { agentRoutes } from './agents.js';
import { mcpRoutes } from './mcp.js';
import { configRoutes } from './config.js';
import { statsRoutes } from './stats.js';

export function setupRoutes(app: Express, getSwarm: () => Swarm): void {
  // Mount route handlers
  app.use('/api/tasks', taskRoutes(getSwarm));
  app.use('/api/agents', agentRoutes(getSwarm));
  app.use('/api/mcp', mcpRoutes(getSwarm));
  app.use('/api/config', configRoutes(getSwarm));
  app.use('/api/stats', statsRoutes(getSwarm));
}

