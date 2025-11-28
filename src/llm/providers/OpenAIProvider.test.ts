/**
 * OpenAIProvider unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from './OpenAIProvider.js';
import nock from 'nock';

describe('OpenAIProvider', () => {
  beforeEach(() => {
    nock.cleanAll();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with API key from config', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should initialize with API key from environment', () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'env-key';
      
      const provider = new OpenAIProvider();
      expect(provider).toBeDefined();
      
      if (originalKey) {
        process.env.OPENAI_API_KEY = originalKey;
      } else {
        delete process.env.OPENAI_API_KEY;
      }
    });

    it('should use custom model from config', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key', model: 'gpt-3.5-turbo' });
      expect(provider).toBeDefined();
    });
  });

  describe('requestCompletion', () => {
    it('should throw error when client not initialized', async () => {
      const provider = new OpenAIProvider();
      await expect(provider.requestCompletion({ prompt: 'test' })).rejects.toThrow();
    });

    it('should make API request with correct parameters', async () => {
      const scope = nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          choices: [{ message: { content: 'Test response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const response = await provider.requestCompletion({ prompt: 'test' });
      
      expect(response.content).toBe('Test response');
      expect(scope.isDone()).toBe(true);
    });

    it('should include system prompt when provided', async () => {
      const scope = nock('https://api.openai.com')
        .post('/v1/chat/completions', (body: any) => {
          return body.messages.some((m: any) => m.role === 'system');
        })
        .reply(200, {
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        });

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await provider.requestCompletion({
        prompt: 'test',
        systemPrompt: 'You are a helpful assistant',
      });
      
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when client is initialized', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider.isAvailable()).toBe(true);
    });

    it('should return false when client is not initialized', () => {
      const provider = new OpenAIProvider();
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe('OpenAI');
    });
  });
});

