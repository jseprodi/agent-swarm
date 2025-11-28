/**
 * Error Pattern Analyzer - Analyzes error patterns for predictive recovery
 */

import type { Task, TaskResult } from '../core/types.js';
import logger from '../utils/logger.js';

/**
 * Error pattern
 */
export interface ErrorPattern {
  pattern: string;
  frequency: number;
  commonCauses: string[];
  suggestedRecovery: string[];
  affectedAgents: string[];
}

/**
 * Error Pattern Analyzer
 */
export class ErrorPatternAnalyzer {
  private errorHistory: Array<{
    taskId: string;
    agentId: string;
    error: string;
    timestamp: number;
    taskDescription: string;
  }> = [];

  /**
   * Record an error
   */
  recordError(task: Task, agentId: string, error: Error): void {
    this.errorHistory.push({
      taskId: task.id,
      agentId,
      error: error.message,
      timestamp: Date.now(),
      taskDescription: task.description,
    });

    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory.shift();
    }
  }

  /**
   * Analyze error patterns
   */
  analyzePatterns(): ErrorPattern[] {
    const patterns: Map<string, ErrorPattern> = new Map();

    // Group errors by message pattern
    const errorGroups = new Map<string, Array<typeof this.errorHistory[0]>>();

    for (const error of this.errorHistory) {
      const pattern = this.extractPattern(error.error);
      if (!errorGroups.has(pattern)) {
        errorGroups.set(pattern, []);
      }
      errorGroups.get(pattern)!.push(error);
    }

    // Build patterns
    for (const [pattern, errors] of errorGroups.entries()) {
      const affectedAgents = [...new Set(errors.map(e => e.agentId))];
      const commonCauses = this.identifyCommonCauses(errors);
      const suggestedRecovery = this.suggestRecovery(pattern, errors);

      patterns.set(pattern, {
        pattern,
        frequency: errors.length,
        commonCauses,
        suggestedRecovery,
        affectedAgents,
      });
    }

    return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Predict if task is likely to fail
   */
  predictFailure(task: Task, agentId: string): {
    likelyToFail: boolean;
    confidence: number;
    reasons: string[];
  } {
    const similarTasks = this.errorHistory.filter(
      e => e.agentId === agentId && this.isSimilarTask(e.taskDescription, task.description)
    );

    if (similarTasks.length === 0) {
      return {
        likelyToFail: false,
        confidence: 0,
        reasons: [],
      };
    }

    const failureRate = similarTasks.length / (similarTasks.length + 10); // Simplified
    const likelyToFail = failureRate > 0.5;

    return {
      likelyToFail,
      confidence: Math.min(failureRate, 1),
      reasons: similarTasks.map(e => e.error).slice(0, 3),
    };
  }

  /**
   * Get recovery suggestions for error
   */
  getRecoverySuggestions(error: Error, task: Task, agentId: string): string[] {
    const pattern = this.extractPattern(error.message);
    const similarErrors = this.errorHistory.filter(
      e => this.extractPattern(e.error) === pattern && e.agentId === agentId
    );

    if (similarErrors.length === 0) {
      return ['Retry with exponential backoff', 'Try fallback agent'];
    }

    // Analyze what worked for similar errors
    const suggestions: string[] = [];

    if (error.message.toLowerCase().includes('timeout')) {
      suggestions.push('Increase timeout', 'Retry with longer delay');
    }

    if (error.message.toLowerCase().includes('network')) {
      suggestions.push('Check network connectivity', 'Retry after delay');
    }

    if (error.message.toLowerCase().includes('rate limit')) {
      suggestions.push('Wait before retrying', 'Use different agent');
    }

    return suggestions.length > 0 ? suggestions : ['Retry with exponential backoff'];
  }

  /**
   * Extract pattern from error message
   */
  private extractPattern(errorMessage: string): string {
    // Normalize error message to extract pattern
    let pattern = errorMessage.toLowerCase();

    // Remove specific values (numbers, IDs, etc.)
    pattern = pattern.replace(/\d+/g, 'N');
    pattern = pattern.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, 'UUID');
    pattern = pattern.replace(/https?:\/\/[^\s]+/g, 'URL');

    // Extract key phrases
    if (pattern.includes('timeout')) return 'timeout_error';
    if (pattern.includes('network') || pattern.includes('connection')) return 'network_error';
    if (pattern.includes('rate limit')) return 'rate_limit_error';
    if (pattern.includes('not found')) return 'not_found_error';
    if (pattern.includes('permission') || pattern.includes('unauthorized')) return 'permission_error';

    return pattern.substring(0, 50); // First 50 chars as pattern
  }

  /**
   * Identify common causes
   */
  private identifyCommonCauses(errors: Array<typeof this.errorHistory[0]>): string[] {
    const causes: string[] = [];

    const errorMessages = errors.map(e => e.error.toLowerCase());

    if (errorMessages.some(m => m.includes('timeout'))) {
      causes.push('Timeout issues - service may be slow or overloaded');
    }

    if (errorMessages.some(m => m.includes('network') || m.includes('connection'))) {
      causes.push('Network connectivity problems');
    }

    if (errorMessages.some(m => m.includes('rate limit'))) {
      causes.push('Rate limiting - too many requests');
    }

    return causes.length > 0 ? causes : ['Unknown cause'];
  }

  /**
   * Suggest recovery strategies
   */
  private suggestRecovery(pattern: string, errors: Array<typeof this.errorHistory[0]>): string[] {
    const suggestions: string[] = [];

    if (pattern.includes('timeout')) {
      suggestions.push('Retry with exponential backoff', 'Increase timeout value');
    }

    if (pattern.includes('network')) {
      suggestions.push('Retry after delay', 'Check network connectivity');
    }

    if (pattern.includes('rate_limit')) {
      suggestions.push('Wait before retrying', 'Use rate limiting');
    }

    return suggestions.length > 0 ? suggestions : ['Retry with exponential backoff'];
  }

  /**
   * Check if tasks are similar
   */
  private isSimilarTask(desc1: string, desc2: string): boolean {
    // Simple similarity check - in production, use more sophisticated NLP
    const words1 = new Set(desc1.toLowerCase().split(/\s+/));
    const words2 = new Set(desc2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;
    return similarity > 0.3; // 30% word overlap
  }

  /**
   * Clear error history
   */
  clear(): void {
    this.errorHistory = [];
    logger.info('Error pattern analyzer history cleared');
  }
}

