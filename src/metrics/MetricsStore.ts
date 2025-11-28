/**
 * Metrics Store - Time-series storage and aggregation
 */

import type { Metric } from './MetricsCollector.js';
import logger from '../utils/logger.js';

/**
 * Time-series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  name: string;
  type: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  labels?: Record<string, string>;
}

/**
 * Metrics Store for time-series data
 */
export class MetricsStore {
  private data: Map<string, TimeSeriesPoint[]> = new Map();
  private maxPointsPerMetric: number = 10000;
  private retentionPeriod: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Record a metric value
   */
  record(metric: Metric): void {
    const key = this.getKey(metric);
    const points = this.data.get(key) || [];

    points.push({
      timestamp: metric.timestamp,
      value: metric.value,
      labels: metric.labels,
    });

    // Trim old data
    this.trimOldData(key, points);

    // Limit size
    if (points.length > this.maxPointsPerMetric) {
      points.splice(0, points.length - this.maxPointsPerMetric);
    }

    this.data.set(key, points);
  }

  /**
   * Get time-series data for a metric
   */
  getTimeSeries(name: string, labels?: Record<string, string>, startTime?: number, endTime?: number): TimeSeriesPoint[] {
    const key = this.getKey({ name, type: '', value: 0, timestamp: 0, labels });
    const points = this.data.get(key) || [];

    if (!startTime && !endTime) {
      return [...points];
    }

    const start = startTime || 0;
    const end = endTime || Date.now();

    return points.filter(p => p.timestamp >= start && p.timestamp <= end);
  }

  /**
   * Aggregate metrics over a time period
   */
  aggregate(
    name: string,
    labels?: Record<string, string>,
    startTime?: number,
    endTime?: number
  ): AggregatedMetrics | null {
    const points = this.getTimeSeries(name, labels, startTime, endTime);

    if (points.length === 0) {
      return null;
    }

    const values = points.map(p => p.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = values[0];
    const max = values[values.length - 1];

    const p50 = this.percentile(values, 0.5);
    const p95 = this.percentile(values, 0.95);
    const p99 = this.percentile(values, 0.99);

    return {
      name,
      type: 'time_series',
      count: values.length,
      sum,
      min,
      max,
      mean,
      p50,
      p95,
      p99,
      labels,
    };
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    const names = new Set<string>();
    for (const key of this.data.keys()) {
      const name = key.split('{')[0];
      names.add(name);
    }
    return Array.from(names);
  }

  /**
   * Clear old data
   */
  clearOldData(): void {
    const cutoff = Date.now() - this.retentionPeriod;
    let cleared = 0;

    for (const [key, points] of this.data.entries()) {
      const filtered = points.filter(p => p.timestamp >= cutoff);
      if (filtered.length < points.length) {
        this.data.set(key, filtered);
        cleared += points.length - filtered.length;
      }

      // Remove empty entries
      if (filtered.length === 0) {
        this.data.delete(key);
      }
    }

    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} old metric data points`);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data.clear();
    logger.info('Metrics store cleared');
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    totalMetrics: number;
    totalPoints: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    let totalPoints = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (const points of this.data.values()) {
      totalPoints += points.length;
      for (const point of points) {
        if (oldestTimestamp === null || point.timestamp < oldestTimestamp) {
          oldestTimestamp = point.timestamp;
        }
        if (newestTimestamp === null || point.timestamp > newestTimestamp) {
          newestTimestamp = point.timestamp;
        }
      }
    }

    return {
      totalMetrics: this.data.size,
      totalPoints,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  private getKey(metric: { name: string; labels?: Record<string, string> }): string {
    if (!metric.labels || Object.keys(metric.labels).length === 0) {
      return metric.name;
    }
    const labelStr = Object.entries(metric.labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${metric.name}{${labelStr}}`;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    const index = Math.floor(sortedValues.length * p);
    return sortedValues[Math.min(index, sortedValues.length - 1)];
  }

  private trimOldData(key: string, points: TimeSeriesPoint[]): void {
    const cutoff = Date.now() - this.retentionPeriod;
    const filtered = points.filter(p => p.timestamp >= cutoff);
    if (filtered.length < points.length) {
      points.splice(0, points.length - filtered.length);
    }
  }
}

