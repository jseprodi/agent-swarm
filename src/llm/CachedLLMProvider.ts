/**
 * Cached LLM Provider - Wraps any LLM provider with caching
 */

import type { ILLMProvider, LLMRequest, LLMResponse } from './types.js';
import type { LLMCache } from '../cache/LLMCache.js';
import logger from '../utils/logger.js';

/**
 * Wrapper that adds caching to any LLM provider
 */
export class CachedLLMProvider implements ILLMProvider {
  private provider: ILLMProvider;
  private cache?: LLMCache;

  constructor(provider: ILLMProvider, cache?: LLMCache) {
    this.provider = provider;
    this.cache = cache;
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(request);
      if (cached) {
        logger.debug(`LLM response retrieved from cache for provider: ${this.provider.getName()}`);
        return cached;
      }
    }

    // Call the actual provider
    const response = await this.provider.requestCompletion(request);

    // Store in cache
    if (this.cache && response) {
      this.cache.set(request, response);
    }

    return response;
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  getName(): string {
    return `Cached(${this.provider.getName()})`;
  }

  /**
   * Get the underlying provider
   */
  getProvider(): ILLMProvider {
    return this.provider;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache?.getStats();
  }
}

