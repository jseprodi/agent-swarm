/**
 * ErrorPatternAnalyzer unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorPatternAnalyzer } from './ErrorPatternAnalyzer.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('ErrorPatternAnalyzer', () => {
  let analyzer: ErrorPatternAnalyzer;

  beforeEach(() => {
    analyzer = new ErrorPatternAnalyzer();
  });

  describe('recordError', () => {
    it('should record error', () => {
      const task = createTestTask('test task');
      const error = new Error('Test error');
      
      analyzer.recordError(task, 'agent-1', error);
      
      const patterns = analyzer.analyzePatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('analyzePatterns', () => {
    it('should identify patterns', () => {
      const task = createTestTask('test');
      analyzer.recordError(task, 'agent-1', new Error('Network timeout'));
      analyzer.recordError(task, 'agent-1', new Error('Network timeout'));
      
      const patterns = analyzer.analyzePatterns();
      
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(2);
    });

    it('should calculate frequencies', () => {
      const task = createTestTask('test');
      for (let i = 0; i < 5; i++) {
        analyzer.recordError(task, 'agent-1', new Error('Timeout error'));
      }
      
      const patterns = analyzer.analyzePatterns();
      const timeoutPattern = patterns.find(p => p.pattern.includes('timeout'));
      
      expect(timeoutPattern?.frequency).toBeGreaterThanOrEqual(5);
    });

    it('should identify common causes', () => {
      const task = createTestTask('test');
      analyzer.recordError(task, 'agent-1', new Error('Network timeout'));
      
      const patterns = analyzer.analyzePatterns();
      expect(patterns[0].commonCauses.length).toBeGreaterThan(0);
    });

    it('should suggest recovery strategies', () => {
      const task = createTestTask('test');
      analyzer.recordError(task, 'agent-1', new Error('Network timeout'));
      
      const patterns = analyzer.analyzePatterns();
      expect(patterns[0].suggestedRecovery.length).toBeGreaterThan(0);
    });
  });

  describe('predictFailure', () => {
    it('should predict based on history', () => {
      const task = createTestTask('similar task');
      analyzer.recordError(createTestTask('similar task'), 'agent-1', new Error('Error'));
      
      const prediction = analyzer.predictFailure(task, 'agent-1');
      
      expect(prediction).toBeDefined();
      expect(prediction.likelyToFail).toBeDefined();
    });

    it('should return confidence score', () => {
      const task = createTestTask('test');
      const prediction = analyzer.predictFailure(task, 'agent-1');
      
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('getRecoverySuggestions', () => {
    it('should suggest strategies', () => {
      const task = createTestTask('test');
      const error = new Error('Network timeout');
      
      const suggestions = analyzer.getRecoverySuggestions(error, task, 'agent-1');
      
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear history', () => {
      const task = createTestTask('test');
      analyzer.recordError(task, 'agent-1', new Error('Error'));
      
      analyzer.clear();
      
      const patterns = analyzer.analyzePatterns();
      expect(patterns.length).toBe(0);
    });
  });
});

