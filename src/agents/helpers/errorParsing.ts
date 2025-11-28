/**
 * Error parsing utilities for ErrorDebuggingAgent
 */

import logger from '../../utils/logger.js';

export interface ErrorAnalysis {
  rootCause?: string;
  fixes?: string[];
  explanation?: string;
  recentErrors?: unknown;
}

export interface NetworkAnalysis {
  problem?: string;
  fixes?: string[];
  suggestedHeaders?: Record<string, string>;
  recentRequests?: unknown;
}

export interface PreventionAnalysis {
  issues?: Array<{ issue: string; severity: string }>;
  recommendations?: string[];
}

/**
 * Parse error analysis from LLM response
 */
export function parseErrorAnalysis(content: string): ErrorAnalysis {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse error analysis as JSON', error);
  }

  return {
    rootCause: extractSection(content, 'root cause', 'explanation'),
    fixes: extractFixes(content),
    explanation: extractSection(content, 'explanation', 'fix'),
  };
}

/**
 * Parse network analysis from LLM response
 */
export function parseNetworkAnalysis(content: string): NetworkAnalysis {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse network analysis as JSON', error);
  }

  return {
    problem: extractSection(content, 'problem', 'fix'),
    fixes: extractFixes(content),
    suggestedHeaders: extractHeaders(content),
  };
}

/**
 * Parse prevention analysis from LLM response
 */
export function parsePreventionAnalysis(content: string): PreventionAnalysis {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    logger.warn('Failed to parse prevention analysis as JSON', error);
  }

  return {
    issues: extractIssuesList(content),
    recommendations: extractRecommendations(content),
  };
}

/**
 * Extract a section from content between keywords
 */
function extractSection(content: string, startKeyword: string, endKeyword: string): string {
  const lowerContent = content.toLowerCase();
  const startIdx = lowerContent.indexOf(startKeyword);
  const endIdx = lowerContent.indexOf(endKeyword, startIdx + startKeyword.length);
  
  if (startIdx !== -1) {
    const end = endIdx !== -1 ? endIdx : startIdx + 500;
    return content.substring(startIdx, end).trim();
  }
  
  return '';
}

/**
 * Extract fixes from content
 */
function extractFixes(content: string): string[] {
  const fixes: string[] = [];
  const lines = content.split('\n');
  let inFixSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('fix') || lowerLine.includes('solution')) {
      inFixSection = true;
    }
    if (inFixSection && (line.trim().startsWith('-') || line.trim().startsWith('1.'))) {
      fixes.push(line.trim());
    }
    if (inFixSection && lowerLine.includes('prevent') && fixes.length > 0) {
      break;
    }
  }

  return fixes;
}

/**
 * Extract issues list from content
 */
function extractIssuesList(content: string): Array<{ issue: string; severity: string }> {
  const issues: Array<{ issue: string; severity: string }> = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim().startsWith('-') || line.trim().match(/^\d+\./)) {
      const severity = detectSeverity(line);
      issues.push({
        issue: line.trim(),
        severity,
      });
    }
  }

  return issues;
}

/**
 * Detect severity from text
 */
function detectSeverity(line: string): string {
  const lower = line.toLowerCase();
  if (lower.includes('critical') || lower.includes('high')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  if (lower.includes('low') || lower.includes('minor')) return 'low';
  return 'medium';
}

/**
 * Extract recommendations from content
 */
function extractRecommendations(content: string): string[] {
  const recommendations: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase();
    if ((lower.includes('recommend') || lower.includes('should') || lower.includes('best practice')) && line.trim().length > 20) {
      recommendations.push(line.trim());
    }
  }

  return recommendations.slice(0, 10);
}

/**
 * Extract headers from content
 */
function extractHeaders(content: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const headerMatch = content.match(/(?:headers?|request headers?)[:]\s*\n((?:\s*['"]?[\w-]+['"]?:\s*['"]?[^'"]+['"]?,?\s*\n?)+)/i);
  
  if (headerMatch) {
    const headerLines = headerMatch[1].split('\n');
    for (const line of headerLines) {
      const match = line.match(/(['"]?)([\w-]+)\1:\s*(['"]?)([^'"]+)\3/);
      if (match) {
        headers[match[2]] = match[4];
      }
    }
  }

  return headers;
}

/**
 * Categorize error type
 */
export function categorizeError(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();
  
  if (lower.includes('undefined') || lower.includes('null')) return 'null_reference';
  if (lower.includes('cannot read') || lower.includes('cannot access')) return 'property_access';
  if (lower.includes('syntax')) return 'syntax_error';
  if (lower.includes('type')) return 'type_error';
  if (lower.includes('reference')) return 'reference_error';
  if (lower.includes('async') || lower.includes('promise')) return 'async_error';
  
  return 'unknown';
}

/**
 * Categorize network error
 */
export function categorizeNetworkError(statusCode?: number): string {
  if (!statusCode) return 'unknown';
  
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 403 || statusCode === 401) return 'authentication';
  if (statusCode === 500) return 'server_error';
  if (statusCode === 0 || statusCode === -1) return 'network_error';
  
  return 'http_error';
}

/**
 * Calculate risk level from issues
 */
export function calculateRiskLevel(issues: Array<{ issue: string; severity: string }>): string {
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  
  if (highCount > 3) return 'critical';
  if (highCount > 0 || mediumCount > 5) return 'high';
  if (mediumCount > 0) return 'medium';
  
  return 'low';
}

