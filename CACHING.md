# Caching Guide

This guide explains how to use the advanced caching strategies in Agent Swarm.

## Overview

The caching system provides multi-level caching for:
- LLM responses
- Task execution results
- Agent computations

## Configuration

Enable caching in your Swarm configuration:

```typescript
import { Swarm } from './src/index.js';

const swarm = new Swarm({
  caching: {
    enabled: true,
    llmCache: {
      enabled: true,
      ttl: 3600000, // 1 hour in milliseconds
      maxSize: 500, // Maximum cached entries
    },
    taskCache: {
      enabled: true,
      ttl: 1800000, // 30 minutes
    },
    storage: 'hybrid', // 'memory' | 'file' | 'hybrid'
    cacheDirectory: 'data/cache',
  },
});
```

## LLM Response Caching

LLM responses are automatically cached when using `CachedLLMProvider`:

```typescript
import { CachedLLMProvider, LLMCache } from './src/index.js';
import { OpenAIProvider } from './src/llm/providers/OpenAIProvider.js';

const llmCache = new LLMCache(500, 3600000); // 500 entries, 1 hour TTL
const provider = new CachedLLMProvider(new OpenAIProvider(config), llmCache);
```

Cache keys are generated from:
- Prompt content
- Temperature
- Max tokens
- Model name
- System prompt

## Task Result Caching

Task results are cached based on:
- Task description hash
- Required capabilities
- Required MCP servers
- Task metadata

Only successful results are cached.

## Cache Statistics

Get cache statistics:

```typescript
const llmCacheStats = llmCache.getStats();
console.log(`Hit rate: ${llmCacheStats.hitRate}`);
console.log(`Cache size: ${llmCacheStats.cacheSize}`);
```

## Cache Invalidation

Invalidate cache entries:

```typescript
// Clear all cache
llmCache.clear();

// Invalidate by filter
llmCache.invalidate(entry => {
  return entry.request.model === 'gpt-4';
});
```

## Best Practices

1. **TTL Selection**: Set appropriate TTLs based on how often your prompts change
2. **Cache Size**: Balance memory usage with cache effectiveness
3. **Storage Type**: Use 'hybrid' for production to get memory speed with file persistence
4. **Monitoring**: Track hit rates to optimize cache configuration

