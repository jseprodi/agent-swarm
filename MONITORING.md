# Monitoring Guide

This guide explains how to use the performance monitoring and metrics system in Agent Swarm.

## Overview

The monitoring system provides:
- Metrics collection (counters, gauges, histograms, timers)
- Time-series storage
- Health monitoring
- API endpoints for metrics access

## Metrics Types

### Counter
Incrementing metrics for counting events:

```typescript
metricsCollector.counter('tasks_completed').inc();
metricsCollector.counter('errors', { agent: 'code-agent' }).inc(5);
```

### Gauge
Current value metrics:

```typescript
metricsCollector.gauge('active_tasks').set(10);
metricsCollector.gauge('memory_usage').inc(100);
```

### Histogram
Distribution metrics:

```typescript
metricsCollector.histogram('response_time').observe(150);
```

### Timer
Duration metrics:

```typescript
const timer = metricsCollector.timer('task_execution');
const stop = timer.start();
// ... do work ...
stop();

// Or use async wrapper
await timer.time(async () => {
  // async work
});
```

## Health Monitoring

The `HealthMonitor` tracks system health:

```typescript
import { HealthMonitor } from './src/metrics/index.js';

const healthMonitor = new HealthMonitor(
  agentRegistry,
  mcpManager,
  taskManager,
  metricsCollector
);

healthMonitor.start(); // Start periodic health checks

const report = healthMonitor.performHealthCheck();
console.log(`System status: ${report.status}`);
```

Health statuses:
- `healthy` - All components operating normally
- `degraded` - Some components have issues but system is functional
- `unhealthy` - Critical components are failing

## API Endpoints

### Get All Metrics
```
GET /api/stats/metrics
```

### Get Agent Metrics
```
GET /api/stats/metrics/agents
```

### Get Task Metrics
```
GET /api/stats/metrics/tasks
```

### Get LLM Metrics
```
GET /api/stats/metrics/llm
```

### Health Check
```
GET /api/stats/health
```

## Metrics Store

Time-series storage for metrics:

```typescript
import { MetricsStore } from './src/metrics/index.js';

const store = new MetricsStore();
store.record(metric);

// Get time-series data
const data = store.getTimeSeries('task_execution_time', undefined, startTime, endTime);

// Aggregate metrics
const aggregated = store.aggregate('task_execution_time', undefined, startTime, endTime);
console.log(`P95: ${aggregated.p95}, P99: ${aggregated.p99}`);
```

## Best Practices

1. **Label Metrics**: Use labels to differentiate metrics by agent, task type, etc.
2. **Monitor Key Metrics**: Track task success rates, execution times, and error rates
3. **Set Alerts**: Use health monitor events to set up alerts
4. **Regular Cleanup**: Clear old metrics data periodically

