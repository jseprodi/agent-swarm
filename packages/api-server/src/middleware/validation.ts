/**
 * Input validation middleware using Zod
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import logger from '../../../../src/utils/logger.js';

/**
 * Validation schemas for API endpoints
 */
export const validationSchemas = {
  createTask: z.object({
    description: z.string().min(1).max(10000),
    metadata: z.record(z.unknown()).optional(),
  }),
  
  connectServer: z.object({
    serverId: z.string().min(1),
  }),
  
  discoverServers: z.object({
    capabilities: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  }),
  
  updateConfig: z.object({
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    enableHealthChecks: z.boolean().optional(),
  }),
};

/**
 * Creates a validation middleware for request body
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Validation error for ${req.path}:`, error.errors);
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }
      logger.error('Unexpected validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  };
}

/**
 * Creates a validation middleware for request query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Query validation error for ${req.path}:`, error.errors);
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors,
        });
        return;
      }
      logger.error('Unexpected validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  };
}

/**
 * Creates a validation middleware for request parameters
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Parameter validation error for ${req.path}:`, error.errors);
        res.status(400).json({
          error: 'Invalid route parameters',
          details: error.errors,
        });
        return;
      }
      logger.error('Unexpected validation error:', error);
      res.status(500).json({
        error: 'Internal server error',
      });
    }
  };
}

