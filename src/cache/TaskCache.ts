/**
 * Task Result Cache - Caching for task execution results
 */

import { MultiLevelCache } from './CacheManager.js';
import type { Task, TaskResult } from '../core/types.js';
import { createHash } from 'crypto';
import logger from '../utils/logger.js';

export interface TaskCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

/**
 * Generate cache key from task
 */
export function generateTaskCacheKey(task: Task): string {
  const keyData = {
    description: task.description,
    requiredCapabilities: task.requiredCapabilities?.sort(),
    requiredMCPServers: task.requiredMCPServers?.sort(),
    metadata: task.metadata,
  };

  const keyString = JSON.stringify(keyData);
  return createHash('sha256').update(keyString).digest('hex');
}

/**
 * Task Result Cache
 */
export class TaskCache {
  private cache: MultiLevelCache<TaskCacheEntry>;
  private stats: TaskCacheStats;

  constructor(
    memoryMaxSize: number = 200,
    memoryTTL?: number,
    fileCacheDir?: string,
    fileTTL?: number
  ) {
    this.cache = new MultiLevelCache<TaskCacheEntry>(
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
   * Get cached task result
   */
  get(task: Task): TaskResult | undefined {
    const key = generateTaskCacheKey(task);
    const entry = this.cache.get(key);

    if (entry) {
      this.stats.hits++;
      this.stats.totalRequests++;
      this.updateHitRate();
      logger.debug(`Task cache hit for task: ${task.id}`);
      return entry.result;
    }

    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateHitRate();
    logger.debug(`Task cache miss for task: ${task.id}`);
    return undefined;
  }

  /**
   * Store task result in cache
   */
  set(task: Task, result: TaskResult, ttl?: number): void {
    // Only cache successful results
    if (!result.success) {
      return;
    }

    const key = generateTaskCacheKey(task);
    const entry: TaskCacheEntry = {
      task,
      result,
      cachedAt: Date.now(),
    };

    this.cache.set(key, entry, ttl);
    logger.debug(`Task result cached for task: ${task.id}`);
  }

  /**
   * Check if task is cached
   */
  has(task: Task): boolean {
    const key = generateTaskCacheKey(task);
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
    logger.info('Task cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): TaskCacheStats & { cacheSize: number } {
    return {
      ...this.stats,
      cacheSize: this.cache.size(),
    };
  }

  /**
   * Invalidate cache entries matching criteria
   */
  invalidate(filter?: (entry: TaskCacheEntry) => boolean): void {
    if (!filter) {
      this.clear();
      return;
    }

    const keys = this.cache.keys();
    let invalidated = 0;

    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && filter(entry)) {
        invalidated++;
      }
    }

    if (invalidated > 0) {
      logger.info(`Invalidated ${invalidated} task cache entries`);
    }
  }

  /**
   * Invalidate cache for specific agent
   */
  invalidateByAgent(agentId: string): void {
    this.invalidate(entry => {
      return entry.task.assignedAgent === agentId;
    });
  }

  /**
   * Invalidate cache for specific capabilities
   */
  invalidateByCapabilities(capabilities: string[]): void {
    this.invalidate(entry => {
      const taskCaps = entry.task.requiredCapabilities || [];
      return capabilities.some(cap => taskCaps.includes(cap));
    });
  }

  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = this.stats.hits / this.stats.totalRequests;
    }
  }
}

/**
 * Cached task entry
 */
interface TaskCacheEntry {
  task: Task;
  result: TaskResult;
  cachedAt: number;
}

