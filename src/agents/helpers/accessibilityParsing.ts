/**
 * Accessibility parsing utilities for AccessibilityAgent
 */

import logger from '../../utils/logger.js';

export interface AuditReport {
  violations?: Array<{ issue: string; level: string; severity: string }>;
  recommendations?: string[];
  contrastIssues?: string[];
  keyboardIssues?: string[];
  ariaIssues?: string[];
  complianceScore?: number;
  automatedResults?: unknown;
}

export interface AccessibilityChange {
  type: string;
  description: string;
}

/**
 * Parse audit report from LLM response
 */
export function parseAuditReport(content: string): AuditReport {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse audit report as JSON', error);
  }

  return {
    violations: extractViolations(content),
    recommendations: extractRecommendations(content),
    contrastIssues: extractContrastIssues(content),
    keyboardIssues: extractKeyboardIssues(content),
    ariaIssues: extractARIAIssues(content),
    complianceScore: calculateComplianceScoreFromText(content),
  };
}

/**
 * Extract violations from content
 */
function extractViolations(content: string): Array<{ issue: string; level: string; severity: string }> {
  const violations: Array<{ issue: string; level: string; severity: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('violation') || lower.includes('issue') || lower.includes('error')) {
      const severity = detectSeverity(line);
      const level = lower.includes('aaa') ? 'AAA' : lower.includes('aa') ? 'AA' : 'A';
      violations.push({
        issue: line.trim(),
        level,
        severity,
      });
    }
  }

  return violations;
}

/**
 * Extract contrast issues
 */
function extractContrastIssues(content: string): string[] {
  const issues: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.toLowerCase().includes('contrast') || line.toLowerCase().includes('color')) {
      issues.push(line.trim());
    }
  }

  return issues;
}

/**
 * Extract keyboard issues
 */
function extractKeyboardIssues(content: string): string[] {
  const issues: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.toLowerCase().includes('keyboard') || line.toLowerCase().includes('tab') || line.toLowerCase().includes('focus')) {
      issues.push(line.trim());
    }
  }

  return issues;
}

/**
 * Extract ARIA issues
 */
function extractARIAIssues(content: string): string[] {
  const issues: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.toLowerCase().includes('aria') || line.toLowerCase().includes('label')) {
      issues.push(line.trim());
    }
  }

  return issues;
}

/**
 * Extract recommendations
 */
function extractRecommendations(content: string): string[] {
  const recommendations: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if ((lower.includes('recommend') || lower.includes('should') || lower.includes('add')) && line.trim().length > 20) {
      recommendations.push(line.trim());
    }
  }

  return recommendations.slice(0, 15);
}

/**
 * Extract changes from content
 */
export function extractChanges(content: string): AccessibilityChange[] {
  const changes: AccessibilityChange[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes('added') || lower.includes('fixed') || lower.includes('improved')) {
      const type = detectChangeType(line);
      changes.push({
        type,
        description: line.trim(),
      });
    }
  }

  return changes;
}

/**
 * Detect change type
 */
function detectChangeType(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('aria') || lower.includes('label')) return 'aria';
  if (lower.includes('alt') || lower.includes('image')) return 'images';
  if (lower.includes('keyboard') || lower.includes('focus') || lower.includes('tab')) return 'keyboard';
  if (lower.includes('contrast') || lower.includes('color')) return 'contrast';
  if (lower.includes('semantic') || lower.includes('heading')) return 'semantic';
  return 'general';
}

/**
 * Detect severity
 */
function detectSeverity(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('critical') || lower.includes('blocking')) return 'critical';
  if (lower.includes('high') || lower.includes('major')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  if (lower.includes('low') || lower.includes('minor')) return 'low';
  return 'medium';
}

/**
 * Calculate compliance score
 */
export function calculateComplianceScore(audit: AuditReport, automatedResults: unknown): number {
  if (automatedResults && typeof automatedResults === 'object') {
    const results = automatedResults as Record<string, unknown>;
    if (results.score !== undefined) {
      return results.score as number;
    }
    if (results.passed !== undefined && results.total !== undefined) {
      return ((results.passed as number) / (results.total as number)) * 100;
    }
  }

  const violations = audit.violations || [];
  const totalChecks = violations.length + 10;
  const passed = totalChecks - violations.length;
  
  return Math.max(0, Math.min(100, (passed / totalChecks) * 100));
}

/**
 * Calculate compliance score from text
 */
function calculateComplianceScoreFromText(content: string): number {
  const violations = (content.match(/violation|error|issue/gi) || []).length;
  const positive = (content.match(/passed|compliant|meets|satisfies/gi) || []).length;
  
  const total = violations + positive || 1;
  const score = (positive / total) * 100;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Extract HTML from content
 */
export function extractHTML(content: string): string {
  const htmlBlockRegex = /```html\n([\s\S]*?)```/g;
  const matches = [...content.matchAll(htmlBlockRegex)];
  
  if (matches.length > 0) {
    return matches.map(m => m[1]).join('\n\n');
  }

  const htmlMatch = content.match(/<html[\s\S]*<\/html>/i) || content.match(/<[\w][\s\S]*>/);
  if (htmlMatch) {
    return htmlMatch[0];
  }

  return content;
}

