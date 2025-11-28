/**
 * Metrics Collection System
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Base metric interface
 */
export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

/**
 * Counter metric - increments over time
 */
export class Counter extends EventEmitter {
  private value: number = 0;
  private name: string;
  private labels?: Record<string, string>;
  private history: Array<{ timestamp: number; value: number }> = [];

  constructor(name: string, labels?: Record<string, string>) {
    super();
    this.name = name;
    this.labels = labels;
  }

  /**
   * Increment counter by amount (default 1)
   */
  inc(amount: number = 1): void {
    this.value += amount;
    this.record();
    this.emit('change', this.value);
  }

  /**
   * Reset counter to 0
   */
  reset(): void {
    this.value = 0;
    this.history = [];
    this.emit('reset');
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric info
   */
  getMetric(): Metric {
    return {
      name: this.name,
      type: 'counter',
      value: this.value,
      timestamp: Date.now(),
      labels: this.labels,
    };
  }

  /**
   * Get history
   */
  getHistory(): Array<{ timestamp: number; value: number }> {
    return [...this.history];
  }

  private record(): void {
    this.history.push({
      timestamp: Date.now(),
      value: this.value,
    });

    // Keep only last 1000 entries
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }
}

/**
 * Gauge metric - current value that can go up or down
 */
export class Gauge extends EventEmitter {
  private value: number = 0;
  private name: string;
  private labels?: Record<string, string>;
  private history: Array<{ timestamp: number; value: number }> = [];

  constructor(name: string, labels?: Record<string, string>) {
    super();
    this.name = name;
    this.labels = labels;
  }

  /**
   * Set gauge value
   */
  set(value: number): void {
    this.value = value;
    this.record();
    this.emit('change', this.value);
  }

  /**
   * Increment gauge
   */
  inc(amount: number = 1): void {
    this.value += amount;
    this.record();
    this.emit('change', this.value);
  }

  /**
   * Decrement gauge
   */
  dec(amount: number = 1): void {
    this.value -= amount;
    this.record();
    this.emit('change', this.value);
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric info
   */
  getMetric(): Metric {
    return {
      name: this.name,
      type: 'gauge',
      value: this.value,
      timestamp: Date.now(),
      labels: this.labels,
    };
  }

  /**
   * Get history
   */
  getHistory(): Array<{ timestamp: number; value: number }> {
    return [...this.history];
  }

  private record(): void {
    this.history.push({
      timestamp: Date.now(),
      value: this.value,
    });

    if (this.history.length > 1000) {
      this.history.shift();
    }
  }
}

/**
 * Histogram metric - distribution of values
 */
export class Histogram extends EventEmitter {
  private values: number[] = [];
  private name: string;
  private labels?: Record<string, string>;
  private buckets: number[] = [];
  private maxSize: number = 1000;

  constructor(name: string, buckets?: number[], labels?: Record<string, string>) {
    super();
    this.name = name;
    this.labels = labels;
    this.buckets = buckets || [0.1, 0.5, 0.9, 0.95, 0.99];
  }

  /**
   * Record a value
   */
  observe(value: number): void {
    this.values.push(value);

    // Keep only last maxSize values
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }

    this.emit('observe', value);
  }

  /**
   * Get statistics
   */
  getStats(): {
    count: number;
    sum: number;
    min: number;
    max: number;
    mean: number;
    percentiles: Record<string, number>;
  } {
    if (this.values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        percentiles: {},
      };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    const percentiles: Record<string, number> = {};
    for (const bucket of this.buckets) {
      const index = Math.floor(sorted.length * bucket);
      percentiles[`p${Math.round(bucket * 100)}`] = sorted[index] || 0;
    }

    return {
      count: sorted.length,
      sum,
      min,
      max,
      mean,
      percentiles,
    };
  }

  /**
   * Get metric info
   */
  getMetric(): Metric & { stats: ReturnType<Histogram['getStats']> } {
    return {
      name: this.name,
      type: 'histogram',
      value: this.values.length,
      timestamp: Date.now(),
      labels: this.labels,
      stats: this.getStats(),
    } as Metric & { stats: ReturnType<Histogram['getStats']> };
  }

  /**
   * Reset histogram
   */
  reset(): void {
    this.values = [];
    this.emit('reset');
  }
}

/**
 * Timer metric - measures duration
 */
export class Timer extends EventEmitter {
  private histogram: Histogram;
  private name: string;
  private labels?: Record<string, string>;

  constructor(name: string, labels?: Record<string, string>) {
    super();
    this.name = name;
    this.labels = labels;
    this.histogram = new Histogram(`${name}_duration`, undefined, labels);
  }

  /**
   * Start timing
   */
  start(): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.histogram.observe(duration);
      this.emit('complete', duration);
    };
  }

  /**
   * Record a duration directly
   */
  record(duration: number): void {
    this.histogram.observe(duration);
  }

  /**
   * Time an async function
   */
  async time<T>(fn: () => Promise<T>): Promise<T> {
    const stop = this.start();
    try {
      const result = await fn();
      stop();
      return result;
    } catch (error) {
      stop();
      throw error;
    }
  }

  /**
   * Time a sync function
   */
  timeSync<T>(fn: () => T): T {
    const stop = this.start();
    try {
      const result = fn();
      stop();
      return result;
    } catch (error) {
      stop();
      throw error;
    }
  }

  /**
   * Get statistics
   */
  getStats(): ReturnType<Histogram['getStats']> {
    return this.histogram.getStats();
  }

  /**
   * Get metric info
   */
  getMetric(): Metric & { stats: ReturnType<Histogram['getStats']> } {
    return {
      name: this.name,
      type: 'timer',
      value: this.histogram.getStats().count,
      timestamp: Date.now(),
      labels: this.labels,
      stats: this.histogram.getStats(),
    } as Metric & { stats: ReturnType<Histogram['getStats']> };
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.histogram.reset();
    this.emit('reset');
  }
}

/**
 * Metrics Collector - central registry for all metrics
 */
export class MetricsCollector extends EventEmitter {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private timers: Map<string, Timer> = new Map();

  /**
   * Get or create a counter
   */
  counter(name: string, labels?: Record<string, string>): Counter {
    const key = this.getKey(name, labels);
    if (!this.counters.has(key)) {
      const counter = new Counter(name, labels);
      this.counters.set(key, counter);
      this.emit('metric_created', { type: 'counter', name, labels });
    }
    return this.counters.get(key)!;
  }

  /**
   * Get or create a gauge
   */
  gauge(name: string, labels?: Record<string, string>): Gauge {
    const key = this.getKey(name, labels);
    if (!this.gauges.has(key)) {
      const gauge = new Gauge(name, labels);
      this.gauges.set(key, gauge);
      this.emit('metric_created', { type: 'gauge', name, labels });
    }
    return this.gauges.get(key)!;
  }

  /**
   * Get or create a histogram
   */
  histogram(name: string, buckets?: number[], labels?: Record<string, string>): Histogram {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      const histogram = new Histogram(name, buckets, labels);
      this.histograms.set(key, histogram);
      this.emit('metric_created', { type: 'histogram', name, labels });
    }
    return this.histograms.get(key)!;
  }

  /**
   * Get or create a timer
   */
  timer(name: string, labels?: Record<string, string>): Timer {
    const key = this.getKey(name, labels);
    if (!this.timers.has(key)) {
      const timer = new Timer(name, labels);
      this.timers.set(key, timer);
      this.emit('metric_created', { type: 'timer', name, labels });
    }
    return this.timers.get(key)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): {
    counters: Metric[];
    gauges: Metric[];
    histograms: Array<Metric & { stats: ReturnType<Histogram['getStats']> }>;
    timers: Array<Metric & { stats: ReturnType<Histogram['getStats']> }>;
  } {
    return {
      counters: Array.from(this.counters.values()).map(c => c.getMetric()),
      gauges: Array.from(this.gauges.values()).map(g => g.getMetric()),
      histograms: Array.from(this.histograms.values()).map(h => h.getMetric()),
      timers: Array.from(this.timers.values()).map(t => t.getMetric()),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.set(0);
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
    for (const timer of this.timers.values()) {
      timer.reset();
    }
    this.emit('reset');
  }

  /**
   * Generate key from name and labels
   */
  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }
}

