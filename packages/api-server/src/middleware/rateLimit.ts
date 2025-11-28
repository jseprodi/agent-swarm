/**
 * Rate limiting middleware
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../../../src/utils/logger.js';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Configuration
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10); // 100 requests per window

/**
 * Simple in-memory rate limiting middleware
 * In production, consider using Redis or a dedicated rate limiting library
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    for (const [k, v] of Object.entries(store)) {
      if (v.resetTime < now) {
        delete store[k];
      }
    }
  }
  
  const record = store[key];
  
  if (!record || record.resetTime < now) {
    // Create new record or reset expired one
    store[key] = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    next();
    return;
  }
  
  record.count++;
  
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    logger.warn(`Rate limit exceeded for ${key} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 1000} seconds.`,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count).toString());
  res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
  
  next();
}

