/**
 * Authentication middleware
 * Supports API key authentication via X-API-Key header
 * Can be extended to support JWT tokens, OAuth, etc.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../../../../src/utils/logger.js';

/**
 * Authentication middleware for API routes
 * Checks for X-API-Key header if API_KEY environment variable is set
 * If API_KEY is not set, authentication is disabled (development mode)
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  const requiredApiKey = process.env.API_KEY;
  
  // If API_KEY is not configured, allow all requests (development mode)
  if (!requiredApiKey) {
    next();
    return;
  }
  
  // If API_KEY is configured, require authentication
  if (!apiKey || typeof apiKey !== 'string') {
    logger.warn(`Unauthorized request attempt from ${req.ip} to ${req.path}`);
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API key required. Provide X-API-Key header.'
    });
    return;
  }
  
  if (apiKey !== requiredApiKey) {
    logger.warn(`Invalid API key attempt from ${req.ip} to ${req.path}`);
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
    return;
  }

  next();
}

