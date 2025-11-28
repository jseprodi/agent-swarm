/**
 * MetricsStore unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsStore } from './MetricsStore.js';
import type { Metric } from './MetricsCollector.js';

describe('MetricsStore', () => {
  let store: MetricsStore;

  beforeEach(() => {
    store = new MetricsStore();
  });

  describe('record', () => {
    it('should store metric', () => {
      const metric: Metric = {
        name: 'test_metric',
        type: 'counter',
        value: 10,
        timestamp: Date.now(),
      };

      store.record(metric);
      
      const timeSeries = store.getTimeSeries('test_metric');
      expect(timeSeries.length).toBe(1);
      expect(timeSeries[0].value).toBe(10);
    });

    it('should store multiple points for same metric', () => {
      const metric1: Metric = {
        name: 'test_metric',
        type: 'counter',
        value: 10,
        timestamp: Date.now(),
      };
      const metric2: Metric = {
        name: 'test_metric',
        type: 'counter',
        value: 20,
        timestamp: Date.now() + 1000,
      };

      store.record(metric1);
      store.record(metric2);
      
      const timeSeries = store.getTimeSeries('test_metric');
      expect(timeSeries.length).toBe(2);
    });

    it('should include labels in storage', () => {
      const metric: Metric = {
        name: 'test_metric',
        type: 'counter',
        value: 10,
        timestamp: Date.now(),
        labels: { agent: 'code-agent' },
      };

      store.record(metric);
      
      const timeSeries = store.getTimeSeries('test_metric', { agent: 'code-agent' });
      expect(timeSeries.length).toBe(1);
    });
  });

  describe('getTimeSeries', () => {
    it('should retrieve time-series data', () => {
      const now = Date.now();
      store.record({
        name: 'test',
        type: 'counter',
        value: 10,
        timestamp: now,
      });
      store.record({
        name: 'test',
        type: 'counter',
        value: 20,
        timestamp: now + 1000,
      });

      const data = store.getTimeSeries('test');
      expect(data.length).toBe(2);
    });

    it('should filter by time range', () => {
      const startTime = Date.now();
      
      store.record({
        name: 'test',
        type: 'counter',
        value: 10,
        timestamp: startTime - 1000,
      });
      store.record({
        name: 'test',
        type: 'counter',
        value: 20,
        timestamp: startTime + 500,
      });
      store.record({
        name: 'test',
        type: 'counter',
        value: 30,
        timestamp: startTime + 2000,
      });

      const data = store.getTimeSeries('test', undefined, startTime, startTime + 1000);
      expect(data.length).toBe(1);
      expect(data[0].value).toBe(20);
    });

    it('should handle labels', () => {
      store.record({
        name: 'test',
        type: 'counter',
        value: 10,
        timestamp: Date.now(),
        labels: { agent: 'agent1' },
      });
      store.record({
        name: 'test',
        type: 'counter',
        value: 20,
        timestamp: Date.now(),
        labels: { agent: 'agent2' },
      });

      const data1 = store.getTimeSeries('test', { agent: 'agent1' });
      const data2 = store.getTimeSeries('test', { agent: 'agent2' });
      
      expect(data1.length).toBe(1);
      expect(data2.length).toBe(1);
    });
  });

  describe('aggregate', () => {
    it('should aggregate metrics over period', () => {
      const startTime = Date.now();
      const values = [10, 20, 30, 40, 50];
      
      values.forEach((value, i) => {
        store.record({
          name: 'test',
          type: 'counter',
          value,
          timestamp: startTime + i * 1000,
        });
      });

      const aggregated = store.aggregate('test', undefined, startTime, startTime + 5000);
      
      expect(aggregated).not.toBeNull();
      expect(aggregated?.count).toBe(5);
      expect(aggregated?.sum).toBe(150);
      expect(aggregated?.min).toBe(10);
      expect(aggregated?.max).toBe(50);
      expect(aggregated?.mean).toBe(30);
    });

    it('should calculate percentiles', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      values.forEach((value) => {
        store.record({
          name: 'test',
          type: 'counter',
          value,
          timestamp: Date.now(),
        });
      });

      const aggregated = store.aggregate('test');
      
      expect(aggregated).not.toBeNull();
      expect(aggregated?.p50).toBeDefined();
      expect(aggregated?.p95).toBeDefined();
      expect(aggregated?.p99).toBeDefined();
    });

    it('should return null for empty time series', () => {
      const aggregated = store.aggregate('nonexistent');
      expect(aggregated).toBeNull();
    });
  });

  describe('getMetricNames', () => {
    it('should return all metric names', () => {
      store.record({ name: 'metric1', type: 'counter', value: 10, timestamp: Date.now() });
      store.record({ name: 'metric2', type: 'gauge', value: 20, timestamp: Date.now() });
      store.record({ name: 'metric1', type: 'counter', value: 30, timestamp: Date.now(), labels: { agent: 'a' } });

      const names = store.getMetricNames();
      expect(names).toContain('metric1');
      expect(names).toContain('metric2');
      expect(names.length).toBe(2);
    });
  });

  describe('clearOldData', () => {
    it('should remove expired entries', () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago

      store.record({
        name: 'test',
        type: 'counter',
        value: 10,
        timestamp: oldTime,
      });
      store.record({
        name: 'test',
        type: 'counter',
        value: 20,
        timestamp: recentTime,
      });

      store.clearOldData();

      const data = store.getTimeSeries('test');
      expect(data.length).toBe(1);
      expect(data[0].value).toBe(20);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      store.record({
        name: 'test',
        type: 'counter',
        value: 10,
        timestamp: Date.now(),
      });

      store.clear();

      const stats = store.getStats();
      expect(stats.totalMetrics).toBe(0);
      expect(stats.totalPoints).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', () => {
      const now = Date.now();
      store.record({
        name: 'test1',
        type: 'counter',
        value: 10,
        timestamp: now,
      });
      store.record({
        name: 'test2',
        type: 'counter',
        value: 20,
        timestamp: now + 1000,
      });

      const stats = store.getStats();
      
      expect(stats.totalMetrics).toBe(2);
      expect(stats.totalPoints).toBe(2);
      expect(stats.oldestTimestamp).toBe(now);
      expect(stats.newestTimestamp).toBe(now + 1000);
    });

    it('should return null timestamps for empty store', () => {
      const stats = store.getStats();
      
      expect(stats.totalMetrics).toBe(0);
      expect(stats.totalPoints).toBe(0);
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
    });
  });
});

