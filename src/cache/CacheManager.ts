/**
 * Cache Manager - Multi-level caching infrastructure
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache interface
 */
export interface ICache<T = unknown> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  has(key: string): boolean;
  size(): number;
  keys(): string[];
}

/**
 * In-memory LRU cache implementation
 */
export class MemoryCache<T = unknown> extends EventEmitter implements ICache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private defaultTTL?: number;

  constructor(maxSize: number = 1000, defaultTTL?: number) {
    super();
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update access metadata
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.emit('set', key, value);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.emit('delete', key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.emit('clear');
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    // Clean expired entries
    this.cleanExpired();
    return this.cache.size;
  }

  keys(): string[] {
    this.cleanExpired();
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
    missRate?: number;
  } {
    return {
      size: this.size(),
      maxSize: this.maxSize,
    };
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }
}

/**
 * File-based persistent cache
 */
export class FileCache<T = unknown> implements ICache<T> {
  private cacheDir: string;
  private cache: Map<string, CacheEntry<T>>;
  private defaultTTL?: number;

  constructor(cacheDir: string, defaultTTL?: number) {
    this.cacheDir = cacheDir;
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.loadFromDisk().catch(err => {
      logger.warn('Failed to load cache from disk:', err);
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return undefined;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    this.saveToDisk(key, entry).catch(err => {
      logger.warn(`Failed to save cache entry ${key} to disk:`, err);
    });
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.deleteFromDisk(key).catch(err => {
        logger.warn(`Failed to delete cache entry ${key} from disk:`, err);
      });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.clearDisk().catch(err => {
      logger.warn('Failed to clear cache from disk:', err);
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    this.cleanExpired();
    return this.cache.size;
  }

  keys(): string[] {
    this.cleanExpired();
    return Array.from(this.cache.keys());
  }

  private async loadFromDisk(): Promise<void> {
    // Implementation would use fs to load cache entries
    // For now, this is a placeholder
  }

  private async saveToDisk(key: string, entry: CacheEntry<T>): Promise<void> {
    // Implementation would use fs to save cache entries
    // For now, this is a placeholder
  }

  private async deleteFromDisk(key: string): Promise<void> {
    // Implementation would use fs to delete cache entries
    // For now, this is a placeholder
  }

  private async clearDisk(): Promise<void> {
    // Implementation would use fs to clear cache directory
    // For now, this is a placeholder
  }

  private cleanExpired(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.delete(key);
    }
  }
}

/**
 * Multi-level cache combining memory and file caches
 */
export class MultiLevelCache<T = unknown> implements ICache<T> {
  private memoryCache: MemoryCache<T>;
  private fileCache?: FileCache<T>;
  private useFileCache: boolean;

  constructor(
    memoryMaxSize: number = 1000,
    memoryTTL?: number,
    fileCacheDir?: string,
    fileTTL?: number
  ) {
    this.memoryCache = new MemoryCache<T>(memoryMaxSize, memoryTTL);
    this.useFileCache = !!fileCacheDir;
    
    if (fileCacheDir) {
      this.fileCache = new FileCache<T>(fileCacheDir, fileTTL);
    }
  }

  get(key: string): T | undefined {
    // Try memory cache first
    const memoryValue = this.memoryCache.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }

    // Try file cache if available
    if (this.useFileCache && this.fileCache) {
      const fileValue = this.fileCache.get(key);
      if (fileValue !== undefined) {
        // Promote to memory cache
        this.memoryCache.set(key, fileValue);
        return fileValue;
      }
    }

    return undefined;
  }

  set(key: string, value: T, ttl?: number): void {
    // Set in memory cache
    this.memoryCache.set(key, value, ttl);
    
    // Set in file cache if available
    if (this.useFileCache && this.fileCache) {
      this.fileCache.set(key, value, ttl);
    }
  }

  delete(key: string): boolean {
    const memoryDeleted = this.memoryCache.delete(key);
    const fileDeleted = this.useFileCache && this.fileCache
      ? this.fileCache.delete(key)
      : false;
    
    return memoryDeleted || fileDeleted;
  }

  clear(): void {
    this.memoryCache.clear();
    if (this.useFileCache && this.fileCache) {
      this.fileCache.clear();
    }
  }

  has(key: string): boolean {
    if (this.memoryCache.has(key)) {
      return true;
    }
    
    if (this.useFileCache && this.fileCache) {
      return this.fileCache.has(key);
    }
    
    return false;
  }

  size(): number {
    return this.memoryCache.size();
  }

  keys(): string[] {
    return this.memoryCache.keys();
  }

  /**
   * Get statistics from all cache levels
   */
  getStats(): {
    memory: ReturnType<MemoryCache<T>['getStats']>;
    file?: { size: number };
  } {
    const stats: {
      memory: ReturnType<MemoryCache<T>['getStats']>;
      file?: { size: number };
    } = {
      memory: this.memoryCache.getStats(),
    };

    if (this.useFileCache && this.fileCache) {
      stats.file = { size: this.fileCache.size() };
    }

    return stats;
  }
}

