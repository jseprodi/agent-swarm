/**
 * AnthropicProvider unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicProvider } from './AnthropicProvider.js';
import nock from 'nock';

describe('AnthropicProvider', () => {
  beforeEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should initialize with API key from environment', () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'env-key';
      
      const provider = new AnthropicProvider();
      expect(provider).toBeDefined();
      
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    });
  });

  describe('requestCompletion', () => {
    it('should throw error when client not initialized', async () => {
      const provider = new AnthropicProvider();
      await expect(provider.requestCompletion({ prompt: 'test' })).rejects.toThrow();
    });

    it('should make API request with correct parameters', async () => {
      const scope = nock('https://api.anthropic.com')
        .post('/v1/messages')
        .reply(200, {
          content: [{ type: 'text', text: 'Test response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        });

      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      const response = await provider.requestCompletion({ prompt: 'test' });
      
      expect(response.content).toBe('Test response');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when client is initialized', () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when client is not initialized', () => {
      const provider = new AnthropicProvider();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      const provider = new AnthropicProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe('Anthropic');
    });
  });
});

