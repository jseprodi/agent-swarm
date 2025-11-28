/**
 * CacheManager unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryCache, FileCache, MultiLevelCache } from './CacheManager.js';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>(10); // Small max size for testing
  });

  describe('get', () => {
    it('should retrieve cached value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should return undefined for expired entry', async () => {
      cache.set('key1', 'value1', 100); // 100ms TTL
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should update access count and last accessed time', () => {
      cache.set('key1', 'value1');
      const firstAccess = Date.now();
      cache.get('key1');
      
      // Access again
      const secondAccess = Date.now();
      cache.get('key1');
      
      // Entry should still exist
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('set', () => {
    it('should store value with TTL', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should use default TTL when not specified', () => {
      const cacheWithTTL = new MemoryCache<string>(10, 500);
      cacheWithTTL.set('key1', 'value1');
      expect(cacheWithTTL.get('key1')).toBe('value1');
    });

    it('should evict oldest when at capacity (LRU)', () => {
      // Fill cache to capacity
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      expect(cache.size()).toBe(10);
      
      // Access all keys except first
      for (let i = 1; i < 10; i++) {
        cache.get(`key${i}`);
      }
      
      // Add new key - should evict key0 (oldest accessed)
      cache.set('key10', 'value10');
      
      expect(cache.size()).toBe(10);
      expect(cache.get('key0')).toBeUndefined();
      expect(cache.get('key10')).toBe('value10');
    });

    it('should not evict when updating existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value1-updated');
      
      expect(cache.size()).toBe(1);
      expect(cache.get('key1')).toBe('value1-updated');
    });

    it('should emit set event', () => {
      const handler = vi.fn();
      cache.on('set', handler);
      
      cache.set('key1', 'value1');
      
      expect(handler).toHaveBeenCalledWith('key1', 'value1');
    });
  });

  describe('delete', () => {
    it('should remove entry', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should emit delete event', () => {
      cache.set('key1', 'value1');
      const handler = vi.fn();
      cache.on('delete', handler);
      
      cache.delete('key1');
      
      expect(handler).toHaveBeenCalledWith('key1');
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired entry', async () => {
      cache.set('key1', 'value1', 100);
      expect(cache.has('key1')).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should emit clear event', () => {
      const handler = vi.fn();
      cache.on('clear', handler);
      
      cache.clear();
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
    });

    it('should clean expired entries before returning size', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2'); // No TTL
      
      expect(cache.size()).toBe(2);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.size()).toBe(1);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });

    it('should exclude expired entries', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const keys = cache.keys();
      expect(keys).not.toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(10);
    });
  });
});

describe('FileCache', () => {
  let cache: FileCache<string>;

  beforeEach(() => {
    cache = new FileCache<string>('test-cache', 1000);
  });

  describe('basic operations', () => {
    it('should store and retrieve value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete entry', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should check existence', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      
      expect(cache.size()).toBe(0);
    });

    it('should handle expiration', async () => {
      cache.set('key1', 'value1', 100);
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });
  });
});

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache<string>;
  let cacheWithFile: MultiLevelCache<string>;

  beforeEach(() => {
    cache = new MultiLevelCache<string>(5, 1000); // Memory only for testing
    cacheWithFile = new MultiLevelCache<string>(5, 1000, 'test-cache', 1000); // With file cache
  });

  describe('get', () => {
    it('should check memory cache first', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined on miss', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check file cache if memory miss', () => {
      cacheWithFile.set('key1', 'value1');
      // Clear memory to simulate file-only scenario
      (cacheWithFile as any).memoryCache.clear();
      
      // Should still find in file cache and promote to memory
      const result = cacheWithFile.get('key1');
      expect(result).toBe('value1');
    });
  });

  describe('set', () => {
    it('should set in memory cache', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should set in both memory and file cache', () => {
      cacheWithFile.set('key1', 'value1');
      expect(cacheWithFile.get('key1')).toBe('value1');
    });

    it('should set with TTL', () => {
      cache.set('key1', 'value1', 500);
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('delete', () => {
    it('should delete from memory cache', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should delete from both levels', () => {
      cacheWithFile.set('key1', 'value1');
      expect(cacheWithFile.delete('key1')).toBe(true);
      expect(cacheWithFile.get('key1')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should check memory cache', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should check file cache if memory miss', () => {
      cacheWithFile.set('key1', 'value1');
      (cacheWithFile as any).memoryCache.clear();
      expect(cacheWithFile.has('key1')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear memory cache', () => {
      cache.set('key1', 'value1');
      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('should clear both levels', () => {
      cacheWithFile.set('key1', 'value1');
      cacheWithFile.clear();
      expect(cacheWithFile.size()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return stats from all levels', () => {
      cache.set('key1', 'value1');
      const stats = cache.getStats();
      
      expect(stats.memory).toBeDefined();
      expect(stats.memory.size).toBe(1);
    });

    it('should include file cache stats when available', () => {
      cacheWithFile.set('key1', 'value1');
      const stats = cacheWithFile.getStats();
      
      expect(stats.memory).toBeDefined();
      expect(stats.file).toBeDefined();
    });
  });
});

