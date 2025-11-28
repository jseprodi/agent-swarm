/**
 * API Server for Agent Swarm
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { Swarm } from '../../../src/index.js';
import { setupRoutes } from './routes/index.js';
import { setupWebSocket } from './websocket/server.js';
import logger from '../../../src/utils/logger.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Swarm instance
let swarmInstance: Swarm | null = null;

function getSwarm(): Swarm {
  if (!swarmInstance) {
    swarmInstance = new Swarm({
      enableHealthChecks: true,
      logLevel: process.env.LOG_LEVEL || 'info',
      llmProvider: (process.env.LLM_PROVIDER as any) || 'cursor',
      llmConfig: {
        apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
        model: process.env.LLM_MODEL,
      },
    });
  }
  return swarmInstance;
}

// Setup routes
setupRoutes(app, getSwarm);

// Setup WebSocket
setupWebSocket(wss, getSwarm);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`Agent Swarm API Server running on port ${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (swarmInstance) {
    await swarmInstance.cleanup();
  }
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

