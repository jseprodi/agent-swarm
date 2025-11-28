/**
 * Configuration routes
 */

import { Router, Request, Response } from 'express';
import { Swarm } from '../../../src/index.js';
import logger from '../../../src/utils/logger.js';

export function configRoutes(getSwarm: () => Swarm): Router {
  const router = Router();

  // Get configuration
  router.get('/', (req: Request, res: Response) => {
    try {
      const swarm = getSwarm();
      const llmProvider = swarm.getLLMProvider();

      res.json({
        llmProvider: {
          name: llmProvider.getName(),
          available: llmProvider.isAvailable(),
        },
        // Add more config as needed
      });
    } catch (error) {
      logger.error('Error getting configuration:', error);
      res.status(500).json({
        error: 'Failed to get configuration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Update configuration (placeholder - would need Swarm to support config updates)
  router.put('/', (req: Request, res: Response) => {
    try {
      // Configuration updates would require recreating the Swarm instance
      // This is a placeholder for future implementation
      res.json({
        message: 'Configuration update not yet implemented',
      });
    } catch (error) {
      logger.error('Error updating configuration:', error);
      res.status(500).json({
        error: 'Failed to update configuration',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get available LLM providers
  router.get('/llm/providers', (req: Request, res: Response) => {
    try {
      res.json({
        providers: [
          { id: 'cursor', name: 'Cursor', description: 'Cursor runtime LLM' },
          { id: 'openai', name: 'OpenAI', description: 'OpenAI GPT models' },
          { id: 'anthropic', name: 'Anthropic', description: 'Anthropic Claude models' },
        ],
      });
    } catch (error) {
      logger.error('Error getting LLM providers:', error);
      res.status(500).json({
        error: 'Failed to get LLM providers',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

