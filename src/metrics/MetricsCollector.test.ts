/**
 * MetricsCollector unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector, Counter, Gauge, Histogram, Timer } from './MetricsCollector.js';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('test_counter');
  });

  describe('inc', () => {
    it('should increment by 1 by default', () => {
      counter.inc();
      expect(counter.getValue()).toBe(1);
    });

    it('should increment by custom amount', () => {
      counter.inc(5);
      expect(counter.getValue()).toBe(5);
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      counter.on('change', handler);
      
      counter.inc();
      
      expect(handler).toHaveBeenCalledWith(1);
    });

    it('should record in history', () => {
      counter.inc();
      counter.inc(2);
      
      const history = counter.getHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].value).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset to 0', () => {
      counter.inc(5);
      counter.reset();
      
      expect(counter.getValue()).toBe(0);
      expect(counter.getHistory().length).toBe(0);
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      counter.on('reset', handler);
      
      counter.reset();
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getValue', () => {
    it('should return current value', () => {
      counter.inc(10);
      expect(counter.getValue()).toBe(10);
    });
  });

  describe('getMetric', () => {
    it('should return metric info', () => {
      counter.inc(5);
      const metric = counter.getMetric();
      
      expect(metric.name).toBe('test_counter');
      expect(metric.type).toBe('counter');
      expect(metric.value).toBe(5);
      expect(metric.timestamp).toBeDefined();
    });

    it('should include labels', () => {
      const labeledCounter = new Counter('test', { agent: 'code-agent' });
      const metric = labeledCounter.getMetric();
      
      expect(metric.labels).toEqual({ agent: 'code-agent' });
    });
  });

  describe('getHistory', () => {
    it('should return history', () => {
      counter.inc();
      counter.inc();
      
      const history = counter.getHistory();
      expect(history.length).toBe(2);
    });

    it('should limit history to 1000 entries', () => {
      for (let i = 0; i < 1001; i++) {
        counter.inc();
      }
      
      const history = counter.getHistory();
      expect(history.length).toBe(1000);
    });
  });
});

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('test_gauge');
  });

  describe('set', () => {
    it('should set value', () => {
      gauge.set(10);
      expect(gauge.getValue()).toBe(10);
    });

    it('should emit change event', () => {
      const handler = vi.fn();
      gauge.on('change', handler);
      
      gauge.set(5);
      
      expect(handler).toHaveBeenCalledWith(5);
    });
  });

  describe('inc', () => {
    it('should increment by 1', () => {
      gauge.set(5);
      gauge.inc();
      expect(gauge.getValue()).toBe(6);
    });

    it('should increment by custom amount', () => {
      gauge.set(5);
      gauge.inc(3);
      expect(gauge.getValue()).toBe(8);
    });
  });

  describe('dec', () => {
    it('should decrement by 1', () => {
      gauge.set(5);
      gauge.dec();
      expect(gauge.getValue()).toBe(4);
    });

    it('should decrement by custom amount', () => {
      gauge.set(5);
      gauge.dec(3);
      expect(gauge.getValue()).toBe(2);
    });
  });

  describe('getValue', () => {
    it('should return current value', () => {
      gauge.set(42);
      expect(gauge.getValue()).toBe(42);
    });
  });

  describe('getMetric', () => {
    it('should return metric info', () => {
      gauge.set(10);
      const metric = gauge.getMetric();
      
      expect(metric.name).toBe('test_gauge');
      expect(metric.type).toBe('gauge');
      expect(metric.value).toBe(10);
    });
  });

  describe('getHistory', () => {
    it('should track history', () => {
      gauge.set(1);
      gauge.set(2);
      
      const history = gauge.getHistory();
      expect(history.length).toBe(2);
    });
  });
});

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram('test_histogram');
  });

  describe('observe', () => {
    it('should record value', () => {
      histogram.observe(10);
      histogram.observe(20);
      
      const stats = histogram.getStats();
      expect(stats.count).toBe(2);
    });

    it('should emit observe event', () => {
      const handler = vi.fn();
      histogram.on('observe', handler);
      
      histogram.observe(10);
      
      expect(handler).toHaveBeenCalledWith(10);
    });

    it('should limit to maxSize entries', () => {
      for (let i = 0; i < 1001; i++) {
        histogram.observe(i);
      }
      
      const stats = histogram.getStats();
      expect(stats.count).toBe(1000);
    });
  });

  describe('getStats', () => {
    it('should return statistics for empty histogram', () => {
      const stats = histogram.getStats();
      
      expect(stats.count).toBe(0);
      expect(stats.sum).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.mean).toBe(0);
    });

    it('should calculate statistics', () => {
      histogram.observe(10);
      histogram.observe(20);
      histogram.observe(30);
      
      const stats = histogram.getStats();
      
      expect(stats.count).toBe(3);
      expect(stats.sum).toBe(60);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(30);
      expect(stats.mean).toBe(20);
    });

    it('should calculate percentiles', () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const value of values) {
        histogram.observe(value);
      }
      
      const stats = histogram.getStats();
      
      expect(stats.percentiles.p50).toBeDefined();
      expect(stats.percentiles.p95).toBeDefined();
      expect(stats.percentiles.p99).toBeDefined();
    });

    it('should use custom buckets', () => {
      const customHistogram = new Histogram('test', [0.5, 0.9, 0.99]);
      customHistogram.observe(10);
      customHistogram.observe(20);
      
      const stats = customHistogram.getStats();
      expect(stats.percentiles.p50).toBeDefined();
      expect(stats.percentiles.p90).toBeDefined();
      expect(stats.percentiles.p99).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear values', () => {
      histogram.observe(10);
      histogram.reset();
      
      const stats = histogram.getStats();
      expect(stats.count).toBe(0);
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      histogram.on('reset', handler);
      
      histogram.reset();
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getMetric', () => {
    it('should return metric with stats', () => {
      histogram.observe(10);
      const metric = histogram.getMetric();
      
      expect(metric.name).toBe('test_histogram');
      expect(metric.type).toBe('histogram');
      expect(metric.stats).toBeDefined();
    });
  });
});

describe('Timer', () => {
  let timer: Timer;

  beforeEach(() => {
    timer = new Timer('test_timer');
  });

  describe('start', () => {
    it('should return stop function', () => {
      const stop = timer.start();
      expect(typeof stop).toBe('function');
      
      stop();
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('record', () => {
    it('should record duration directly', () => {
      timer.record(100);
      timer.record(200);
      
      const stats = timer.getStats();
      expect(stats.count).toBe(2);
      expect(stats.mean).toBe(150);
    });
  });

  describe('time', () => {
    it('should time async function', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };
      
      const result = await timer.time(fn);
      
      expect(result).toBe('result');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
      expect(stats.mean).toBeGreaterThan(0);
    });

    it('should handle errors in async function', async () => {
      const fn = async () => {
        throw new Error('test error');
      };
      
      await expect(timer.time(fn)).rejects.toThrow('test error');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('timeSync', () => {
    it('should time sync function', () => {
      const fn = () => {
        return 'result';
      };
      
      const result = timer.timeSync(fn);
      
      expect(result).toBe('result');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
    });

    it('should handle errors in sync function', () => {
      const fn = () => {
        throw new Error('test error');
      };
      
      expect(() => timer.timeSync(fn)).toThrow('test error');
      const stats = timer.getStats();
      expect(stats.count).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return duration statistics', () => {
      timer.record(100);
      timer.record(200);
      
      const stats = timer.getStats();
      expect(stats.count).toBe(2);
      expect(stats.mean).toBe(150);
    });
  });

  describe('reset', () => {
    it('should reset timer', () => {
      timer.record(100);
      timer.reset();
      
      const stats = timer.getStats();
      expect(stats.count).toBe(0);
    });
  });

  describe('getMetric', () => {
    it('should return metric with stats', () => {
      timer.record(100);
      const metric = timer.getMetric();
      
      expect(metric.name).toBe('test_timer');
      expect(metric.type).toBe('timer');
      expect(metric.stats).toBeDefined();
    });
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('counter', () => {
    it('should get or create counter', () => {
      const counter1 = collector.counter('test');
      const counter2 = collector.counter('test');
      
      expect(counter1).toBe(counter2);
    });

    it('should create separate counters with different labels', () => {
      const counter1 = collector.counter('test', { agent: 'agent1' });
      const counter2 = collector.counter('test', { agent: 'agent2' });
      
      expect(counter1).not.toBe(counter2);
    });
  });

  describe('gauge', () => {
    it('should get or create gauge', () => {
      const gauge1 = collector.gauge('test');
      const gauge2 = collector.gauge('test');
      
      expect(gauge1).toBe(gauge2);
    });
  });

  describe('histogram', () => {
    it('should get or create histogram', () => {
      const hist1 = collector.histogram('test');
      const hist2 = collector.histogram('test');
      
      expect(hist1).toBe(hist2);
    });

    it('should use custom buckets', () => {
      const hist = collector.histogram('test', [0.5, 0.9]);
      hist.observe(10);
      hist.observe(20);
      const stats = hist.getStats();
      
      expect(stats.percentiles.p50).toBeDefined();
      expect(stats.percentiles.p90).toBeDefined();
    });
  });

  describe('timer', () => {
    it('should get or create timer', () => {
      const timer1 = collector.timer('test');
      const timer2 = collector.timer('test');
      
      expect(timer1).toBe(timer2);
    });
  });

  describe('getAllMetrics', () => {
    it('should return all metrics', () => {
      collector.counter('counter1').inc();
      collector.gauge('gauge1').set(10);
      collector.histogram('hist1').observe(5);
      collector.timer('timer1').record(100);
      
      const allMetrics = collector.getAllMetrics();
      
      expect(allMetrics.counters.length).toBe(1);
      expect(allMetrics.gauges.length).toBe(1);
      expect(allMetrics.histograms.length).toBe(1);
      expect(allMetrics.timers.length).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      collector.counter('test').inc(5);
      collector.gauge('test').set(10);
      
      collector.reset();
      
      expect(collector.counter('test').getValue()).toBe(0);
      expect(collector.gauge('test').getValue()).toBe(0);
    });

    it('should emit reset event', () => {
      const handler = vi.fn();
      collector.on('reset', handler);
      
      collector.reset();
      
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('label handling', () => {
    it('should create separate metrics for different labels', () => {
      const counter1 = collector.counter('test', { agent: 'agent1' });
      const counter2 = collector.counter('test', { agent: 'agent2' });
      
      counter1.inc();
      counter2.inc(2);
      
      expect(counter1.getValue()).toBe(1);
      expect(counter2.getValue()).toBe(2);
    });

    it('should handle labels in keys', () => {
      const counter1 = collector.counter('test', { a: '1', b: '2' });
      const counter2 = collector.counter('test', { b: '2', a: '1' }); // Different order
      
      // Should be the same metric (sorted labels)
      expect(counter1).toBe(counter2);
    });
  });
});

