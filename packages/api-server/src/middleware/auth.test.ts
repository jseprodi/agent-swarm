/**
 * Authentication middleware tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth.js';

describe('authMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should allow request with valid API key', () => {
    const originalKey = process.env.API_KEY;
    process.env.API_KEY = 'test-key';
    
    req.headers = { 'x-api-key': 'test-key' };
    
    authMiddleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    
    if (originalKey) {
      process.env.API_KEY = originalKey;
    } else {
      delete process.env.API_KEY;
    }
  });

  it('should reject request without API key', () => {
    const originalKey = process.env.API_KEY;
    process.env.API_KEY = 'test-key';
    
    req.headers = {};
    
    authMiddleware(req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    
    if (originalKey) {
      process.env.API_KEY = originalKey;
    } else {
      delete process.env.API_KEY;
    }
  });

  it('should reject request with invalid API key', () => {
    const originalKey = process.env.API_KEY;
    process.env.API_KEY = 'test-key';
    
    req.headers = { 'x-api-key': 'wrong-key' };
    
    authMiddleware(req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    
    if (originalKey) {
      process.env.API_KEY = originalKey;
    } else {
      delete process.env.API_KEY;
    }
  });

  it('should allow request when API_KEY not set', () => {
    const originalKey = process.env.API_KEY;
    delete process.env.API_KEY;
    
    req.headers = {};
    
    authMiddleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    
    if (originalKey) {
      process.env.API_KEY = originalKey;
    }
  });
});

