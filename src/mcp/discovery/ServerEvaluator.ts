/**
 * Evaluates and ranks MCP servers based on task requirements
 */

import type { MCPServerDiscoveryResult } from '../types.js';
import logger from '../../utils/logger.js';

export interface EvaluationCriteria {
  requiredCapabilities: string[];
  keywords?: string[];
  preferredTags?: string[];
  reliabilityWeight?: number; // 0-1
  capabilityMatchWeight?: number; // 0-1
  popularityWeight?: number; // 0-1
}

export interface ServerEvaluation {
  server: MCPServerDiscoveryResult;
  score: number;
  reasoning: string[];
  matchedCapabilities: string[];
  missingCapabilities: string[];
}

export class ServerEvaluator {
  /**
   * Evaluate a list of servers against criteria
   */
  evaluateServers(
    servers: MCPServerDiscoveryResult[],
    criteria: EvaluationCriteria
  ): ServerEvaluation[] {
    logger.info(`Evaluating ${servers.length} servers against criteria`);

    const evaluations: ServerEvaluation[] = servers.map(server =>
      this.evaluateServer(server, criteria)
    );

    // Sort by score (highest first)
    evaluations.sort((a, b) => b.score - a.score);

    logger.info(`Top 3 servers: ${evaluations.slice(0, 3).map(e => `${e.server.name} (${e.score.toFixed(2)})`).join(', ')}`);

    return evaluations;
  }

  /**
   * Evaluate a single server
   */
  private evaluateServer(
    server: MCPServerDiscoveryResult,
    criteria: EvaluationCriteria
  ): ServerEvaluation {
    const reasoning: string[] = [];
    let score = 0;

    // Default weights
    const capabilityWeight = criteria.capabilityMatchWeight ?? 0.6;
    const keywordWeight = 0.2;
    const tagWeight = 0.15;
    const popularityWeight = criteria.popularityWeight ?? 0.05;

    // 1. Capability matching (most important)
    const capabilityScore = this.evaluateCapabilities(server, criteria.requiredCapabilities);
    score += capabilityScore * capabilityWeight;
    reasoning.push(`Capability match: ${(capabilityScore * 100).toFixed(0)}%`);

    // 2. Keyword matching
    if (criteria.keywords && criteria.keywords.length > 0) {
      const keywordScore = this.evaluateKeywords(server, criteria.keywords);
      score += keywordScore * keywordWeight;
      if (keywordScore > 0) {
        reasoning.push(`Keyword match: ${(keywordScore * 100).toFixed(0)}%`);
      }
    }

    // 3. Tag matching
    if (criteria.preferredTags && criteria.preferredTags.length > 0) {
      const tagScore = this.evaluateTags(server, criteria.preferredTags);
      score += tagScore * tagWeight;
      if (tagScore > 0) {
        reasoning.push(`Tag match: ${(tagScore * 100).toFixed(0)}%`);
      }
    }

    // 4. Popularity/quality indicators
    const popularityScore = this.evaluatePopularity(server);
    score += popularityScore * popularityWeight;
    if (popularityScore > 0) {
      reasoning.push(`Popularity/quality: ${(popularityScore * 100).toFixed(0)}%`);
    }

    // Identify matched and missing capabilities
    const matchedCapabilities = this.getMatchedCapabilities(server, criteria.requiredCapabilities);
    const missingCapabilities = criteria.requiredCapabilities.filter(
      cap => !matchedCapabilities.includes(cap)
    );

    return {
      server,
      score: Math.min(score, 1.0), // Cap at 1.0
      reasoning,
      matchedCapabilities,
      missingCapabilities,
    };
  }

  /**
   * Evaluate how well server capabilities match requirements
   */
  private evaluateCapabilities(
    server: MCPServerDiscoveryResult,
    requiredCapabilities: string[]
  ): number {
    if (requiredCapabilities.length === 0) return 1.0;

    const matched: string[] = [];

    for (const required of requiredCapabilities) {
      // Check tools
      if (server.capabilities.tools?.some(tool => 
        tool.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(tool.toLowerCase())
      )) {
        matched.push(required);
        continue;
      }

      // Check resources
      if (server.capabilities.resources?.some(resource => 
        resource.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(resource.toLowerCase())
      )) {
        matched.push(required);
        continue;
      }

      // Check prompts
      if (server.capabilities.prompts?.some(prompt => 
        prompt.toLowerCase().includes(required.toLowerCase()) ||
        required.toLowerCase().includes(prompt.toLowerCase())
      )) {
        matched.push(required);
        continue;
      }

      // Check name/description for capability keywords
      const searchText = `${server.name} ${server.description || ''}`.toLowerCase();
      if (searchText.includes(required.toLowerCase())) {
        matched.push(required);
      }
    }

    return matched.length / requiredCapabilities.length;
  }

  /**
   * Evaluate keyword matching
   */
  private evaluateKeywords(
    server: MCPServerDiscoveryResult,
    keywords: string[]
  ): number {
    const searchText = `${server.name} ${server.description || ''} ${server.tags?.join(' ') || ''}`.toLowerCase();
    
    const matched = keywords.filter(keyword =>
      searchText.includes(keyword.toLowerCase())
    );

    return keywords.length > 0 ? matched.length / keywords.length : 0;
  }

  /**
   * Evaluate tag matching
   */
  private evaluateTags(
    server: MCPServerDiscoveryResult,
    preferredTags: string[]
  ): number {
    if (!server.tags || server.tags.length === 0) return 0;

    const serverTagsLower = server.tags.map(t => t.toLowerCase());
    const preferredTagsLower = preferredTags.map(t => t.toLowerCase());

    const matched = preferredTagsLower.filter(tag =>
      serverTagsLower.includes(tag)
    );

    return preferredTags.length > 0 ? matched.length / preferredTags.length : 0;
  }

  /**
   * Evaluate popularity/quality indicators
   */
  private evaluatePopularity(server: MCPServerDiscoveryResult): number {
    let score = 0;

    // Having a repository is good
    if (server.repository) score += 0.3;

    // Having an npm package is good (easier to install)
    if (server.npmPackage) score += 0.3;

    // Having a version indicates maintenance
    if (server.version) score += 0.2;

    // Having detailed capabilities is good
    const capabilityCount = 
      (server.capabilities.tools?.length || 0) +
      (server.capabilities.resources?.length || 0) +
      (server.capabilities.prompts?.length || 0);
    
    if (capabilityCount > 0) score += Math.min(capabilityCount / 10, 0.2);

    return Math.min(score, 1.0);
  }

  /**
   * Get capabilities that match requirements
   */
  private getMatchedCapabilities(
    server: MCPServerDiscoveryResult,
    requiredCapabilities: string[]
  ): string[] {
    const matched: string[] = [];

    for (const required of requiredCapabilities) {
      const hasCapability =
        server.capabilities.tools?.some(tool => 
          tool.toLowerCase().includes(required.toLowerCase()) ||
          required.toLowerCase().includes(tool.toLowerCase())
        ) ||
        server.capabilities.resources?.some(resource => 
          resource.toLowerCase().includes(required.toLowerCase()) ||
          required.toLowerCase().includes(resource.toLowerCase())
        ) ||
        server.capabilities.prompts?.some(prompt => 
          prompt.toLowerCase().includes(required.toLowerCase()) ||
          required.toLowerCase().includes(prompt.toLowerCase())
        ) ||
        `${server.name} ${server.description || ''}`.toLowerCase().includes(required.toLowerCase());

      if (hasCapability) {
        matched.push(required);
      }
    }

    return matched;
  }

  /**
   * Select best servers from evaluations
   */
  selectBestServers(
    evaluations: ServerEvaluation[],
    minScore: number = 0.3,
    maxCount: number = 5
  ): MCPServerDiscoveryResult[] {
    const selected = evaluations
      .filter(evaluation => evaluation.score >= minScore)
      .slice(0, maxCount)
      .map(evaluation => evaluation.server);

    logger.info(`Selected ${selected.length} servers with score >= ${minScore}`);
    return selected;
  }
}

