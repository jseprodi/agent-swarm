/**
 * Validation middleware tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from './validation.js';

describe('validate middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should pass valid request', () => {
    const schema = z.object({
      name: z.string(),
    });

    req.body = { name: 'Test' };
    
    const middleware = validateBody(schema);
    middleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject invalid request', () => {
    const schema = z.object({
      name: z.string(),
    });

    req.body = { name: 123 }; // Invalid type
    
    const middleware = validateBody(schema);
    middleware(req as Request, res as Response, next);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should validate query parameters', () => {
    const schema = z.object({
      page: z.string().optional(),
    });

    req.query = { page: '1' };
    
    const middleware = validateQuery(schema);
    middleware(req as Request, res as Response, next);
    
    expect(next).toHaveBeenCalled();
  });
});

