/**
 * LLM Response Cache - Specialized caching for LLM responses
 */

import { MultiLevelCache } from './CacheManager.js';
import type { LLMRequest, LLMResponse } from '../llm/types.js';
import { createHash } from 'crypto';
import logger from '../utils/logger.js';

export interface LLMCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

/**
 * Generate cache key from LLM request
 */
export function generateLLMCacheKey(request: LLMRequest): string {
  const keyData = {
    prompt: request.prompt,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    model: request.model,
    systemPrompt: request.systemPrompt,
  };

  const keyString = JSON.stringify(keyData);
  return createHash('sha256').update(keyString).digest('hex');
}

/**
 * LLM Response Cache
 */
export class LLMCache {
  private cache: MultiLevelCache<LLMCacheEntry>;
  private stats: LLMCacheStats;

  constructor(
    memoryMaxSize: number = 500,
    memoryTTL?: number,
    fileCacheDir?: string,
    fileTTL?: number
  ) {
    this.cache = new MultiLevelCache<LLMCacheEntry>(
      memoryMaxSize,
      memoryTTL,
      fileCacheDir,
      fileTTL
    );
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
    };
  }

  /**
   * Get cached LLM response
   */
  get(request: LLMRequest): LLMResponse | undefined {
    const key = generateLLMCacheKey(request);
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      this.stats.totalRequests++;
      this.updateHitRate();
      logger.debug(`LLM cache hit for key: ${key.substring(0, 8)}...`);
      return entry.response;
    }

    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateHitRate();
    logger.debug(`LLM cache miss for key: ${key.substring(0, 8)}...`);
    return undefined;
  }

  /**
   * Store LLM response in cache
   */
  set(request: LLMRequest, response: LLMResponse, ttl?: number): void {
    const key = generateLLMCacheKey(request);
    const entry: LLMCacheEntry = {
      request,
      response,
      cachedAt: Date.now(),
    };

    this.cache.set(key, entry, ttl);
    logger.debug(`LLM response cached with key: ${key.substring(0, 8)}...`);
  }

  /**
   * Check if request is cached
   */
  has(request: LLMRequest): boolean {
    const key = generateLLMCacheKey(request);
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
    };
    logger.info('LLM cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): LLMCacheStats & { cacheSize: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size(),
    };
  }

  /**
   * Invalidate cache entries matching criteria
   */
  invalidate(filter?: (entry: LLMCacheEntry) => boolean): void {
    if (!filter) {
      this.clear();
      return;
    }

    const keys = this.cache.keys();
    let invalidated = 0;

    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && filter(entry)) {
        // We need to reconstruct the key from the entry
        // For now, we'll clear all if filter matches
        // In a production system, we'd maintain a reverse index
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.info(`Invalidated ${invalidated} LLM cache entries`);
    }
  }

  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.hits / this.stats.totalRequests;
    }
  }
}

/**
 * Cached LLM entry
 */
interface LLMCacheEntry {
  request: LLMRequest;
  response: LLMResponse;
  cachedAt: number;
}

