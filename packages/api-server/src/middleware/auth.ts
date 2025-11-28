/**
 * Authentication middleware (placeholder)
 * Can be extended to support API keys, JWT tokens, etc.
 */

import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Placeholder authentication
  // In production, implement proper auth (API keys, JWT, etc.)
  
  const apiKey = req.headers['x-api-key'];
  
  if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

