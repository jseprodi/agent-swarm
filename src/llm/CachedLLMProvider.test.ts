/**
 * CachedLLMProvider unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CachedLLMProvider } from './CachedLLMProvider.js';
import { LLMCache } from '../cache/LLMCache.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import type { LLMRequest, LLMResponse } from './types.js';

describe('CachedLLMProvider', () => {
  let provider: CachedLLMProvider;
  let mockProvider: MockLLMProvider;
  let cache: LLMCache;
  let mockRequest: LLMRequest;
  let mockResponse: LLMResponse;

  beforeEach(() => {
    mockProvider = new MockLLMProvider(true);
    cache = new LLMCache(10, 1000);
    provider = new CachedLLMProvider(mockProvider, cache);
    
    mockRequest = {
      prompt: 'test prompt',
      temperature: 0.7,
    };
    mockResponse = {
      content: 'test response',
      usage: { promptTokens: 10, completionTokens: 20 },
    };
    
    mockProvider.setResponse('test prompt', mockResponse);
  });

  describe('constructor', () => {
    it('should create provider with cache', () => {
      expect(provider).toBeDefined();
      expect(provider.getProvider()).toBe(mockProvider);
    });

    it('should create provider without cache', () => {
      const providerNoCache = new CachedLLMProvider(mockProvider);
      expect(providerNoCache).toBeDefined();
    });
  });

  describe('requestCompletion', () => {
    it('should return cached response on hit', async () => {
      // First call - cache miss, should call provider
      const firstCall = await provider.requestCompletion(mockRequest);
      expect(firstCall.content).toBe('test response');
      
      // Second call - cache hit, should not call provider again
      const callSpy = vi.spyOn(mockProvider, 'requestCompletion');
      const secondCall = await provider.requestCompletion(mockRequest);
      
      expect(secondCall.content).toBe('test response');
      expect(callSpy).not.toHaveBeenCalled();
    });

    it('should call provider and cache on miss', async () => {
      const newRequest: LLMRequest = { prompt: 'new prompt' };
      const newResponse: LLMResponse = { content: 'new response' };
      mockProvider.setResponse('new prompt', newResponse);
      
      const result = await provider.requestCompletion(newRequest);
      
      expect(result.content).toBe('new response');
      expect(cache.has(newRequest)).toBe(true);
    });

    it('should store response in cache', async () => {
      await provider.requestCompletion(mockRequest);
      
      expect(cache.has(mockRequest)).toBe(true);
      const cached = cache.get(mockRequest);
      expect(cached?.content).toBe('test response');
    });

    it('should work without cache', async () => {
      const providerNoCache = new CachedLLMProvider(mockProvider);
      const result = await providerNoCache.requestCompletion(mockRequest);
      
      expect(result.content).toBe('test response');
    });
  });

  describe('isAvailable', () => {
    it('should delegate to provider', () => {
      expect(provider.isAvailable()).toBe(true);
      
      mockProvider.setAvailable(false);
      expect(provider.isAvailable()).toBe(false);
    });
  });

  describe('getName', () => {
    it('should return cached provider name', () => {
      expect(provider.getName()).toBe('Cached(Mock)');
    });
  });

  describe('getProvider', () => {
    it('should return underlying provider', () => {
      expect(provider.getProvider()).toBe(mockProvider);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await provider.requestCompletion(mockRequest);
      await provider.requestCompletion(mockRequest); // Hit
      
      const stats = provider.getCacheStats();
      expect(stats).toBeDefined();
      expect(stats?.hits).toBeGreaterThan(0);
    });

    it('should return undefined when no cache', () => {
      const providerNoCache = new CachedLLMProvider(mockProvider);
      expect(providerNoCache.getCacheStats()).toBeUndefined();
    });
  });
});

