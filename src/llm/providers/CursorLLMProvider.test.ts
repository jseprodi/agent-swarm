/**
 * CursorLLMProvider unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CursorLLMProvider } from './CursorLLMProvider.js';

describe('CursorLLMProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize provider', () => {
      const provider = new CursorLLMProvider();
      expect(provider).toBeDefined();
    });

    it('should detect Cursor context from environment', () => {
      process.env.CURSOR = 'true';
      const provider = new CursorLLMProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('should detect Cursor context from CURSOR_CONTEXT', () => {
      process.env.CURSOR_CONTEXT = 'true';
      const provider = new CursorLLMProvider();
      expect(provider.isAvailable()).toBe(true);
    });
  });

  describe('requestCompletion', () => {
    it('should return placeholder when not in Cursor context', async () => {
      delete process.env.CURSOR;
      delete process.env.CURSOR_CONTEXT;
      
      const provider = new CursorLLMProvider();
      const response = await provider.requestCompletion({ prompt: 'test' });
      
      expect(response.content).toContain('LLM response would be generated');
    });

    it('should return response when in Cursor context', async () => {
      process.env.CURSOR = 'true';
      
      const provider = new CursorLLMProvider();
      const response = await provider.requestCompletion({ prompt: 'test prompt' });
      
      expect(response.content).toBeDefined();
      // Usage may or may not be defined depending on implementation
    });
  });

  describe('isAvailable', () => {
    it('should return true in Cursor context', () => {
      process.env.CURSOR = 'true';
      const provider = new CursorLLMProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when not in Cursor context', () => {
      delete process.env.CURSOR;
      delete process.env.CURSOR_CONTEXT;
      const provider = new CursorLLMProvider();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      const provider = new CursorLLMProvider();
      expect(provider.getName()).toBe('Cursor');
    });
  });
});

