/**
 * API Server for Agent Swarm
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import { Swarm, type LLMProviderType } from '../../../src/index.js';
import { setupRoutes } from './routes/index.js';
import { setupWebSocket } from './websocket/server.js';
import { DEFAULT_BODY_SIZE_LIMIT, DEFAULT_PORT } from './constants.js';
import logger from '../../../src/utils/logger.js';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: DEFAULT_BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: DEFAULT_BODY_SIZE_LIMIT }));

// Initialize Swarm instance
let swarmInstance: Swarm | null = null;

function getSwarm(): Swarm {
  if (!swarmInstance) {
    const llmProvider = (process.env.LLM_PROVIDER as LLMProviderType | undefined) || 'cursor';
    
    // Validate LLM provider type
    const validProviders: LLMProviderType[] = ['cursor', 'openai', 'anthropic'];
    const provider: LLMProviderType = validProviders.includes(llmProvider) 
      ? llmProvider 
      : 'cursor';
    
    swarmInstance = new Swarm({
      enableHealthChecks: true,
      logLevel: process.env.LOG_LEVEL || 'info',
      llmProvider: provider,
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

const PORT = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

server.listen(PORT, () => {
  logger.info(`Agent Swarm API Server running on port ${PORT}`);
  logger.info(`WebSocket server ready on ws://localhost:${PORT}`);
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });
  
  // Close WebSocket server
  wss.close(() => {
    logger.info('WebSocket server closed');
  });
  
  // Cleanup Swarm instance
  if (swarmInstance) {
    try {
      await swarmInstance.cleanup();
      logger.info('Swarm instance cleaned up');
    } catch (error) {
      logger.error('Error during Swarm cleanup:', error);
    }
  }
  
  // Give connections time to close
  setTimeout(() => {
    logger.info('Shutdown complete');
    process.exit(0);
  }, 5000); // 5 second grace period
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

