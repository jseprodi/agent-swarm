/**
 * MCP Discovery Agent - discovers and connects to publicly registered MCP servers
 */

import { BaseAgent } from '../core/Agent.js';
import type { Task, TaskResult } from '../core/types.js';
import type { ILLMProvider } from '../llm/types.js';
import { MCPManager } from '../mcp/MCPManager.js';
import { RegistrySearch } from '../mcp/discovery/RegistrySearch.js';
import { ServerEvaluator } from '../mcp/discovery/ServerEvaluator.js';
import type { MCPServerDiscoveryResult, MCPServerMetadata } from '../mcp/types.js';
import logger from '../utils/logger.js';

export class MCPDiscoveryAgent extends BaseAgent {
  private mcpManager: MCPManager;
  private registrySearch: RegistrySearch;
  private serverEvaluator: ServerEvaluator;

  constructor(mcpManager: MCPManager, llm?: ILLMProvider) {
    super(
      'mcp-discovery-agent',
      'MCP Discovery Agent',
      'Discovers and connects to publicly registered MCP servers based on task requirements',
      ['mcp_discovery'],
      llm
    );

    this.mcpManager = mcpManager;
    this.registrySearch = new RegistrySearch();
    this.serverEvaluator = new ServerEvaluator();
  }

  async execute(task: Task): Promise<TaskResult> {
    logger.info(`MCPDiscoveryAgent executing task: ${task.id} - ${task.description}`);

    try {
      // Determine required MCP server capabilities from task
      const requiredCapabilities = await this.determineRequiredCapabilities(task);

      logger.info(`Required MCP capabilities: ${requiredCapabilities.join(', ')}`);

      // Search for MCP servers
      const discoveredServers = await this.searchServers(requiredCapabilities);

      if (discoveredServers.length === 0) {
        logger.warn(`No MCP servers found for capabilities: ${requiredCapabilities.join(', ')}`);
        return this.createSuccessResult(
          task.id,
          {
            discoveredServers: [],
            connectedServers: [],
            message: 'No suitable MCP servers found',
          },
          { requiredCapabilities }
        );
      }

      // Evaluate and rank servers
      const evaluations = this.serverEvaluator.evaluateServers(discoveredServers, {
        requiredCapabilities,
      });

      // Select best servers
      const selectedServers = this.serverEvaluator.selectBestServers(evaluations, 0.3, 5);

      logger.info(`Selected ${selectedServers.length} MCP servers to connect`);

      // Connect to selected servers
      const connectedServers: string[] = [];
      const connectionResults: Array<{ serverId: string; success: boolean; error?: string }> = [];

      for (const server of selectedServers) {
        try {
          const serverMetadata = await this.registerServer(server);
          const client = await this.mcpManager.connectServer(serverMetadata.id);
          connectedServers.push(serverMetadata.id);
          connectionResults.push({ serverId: serverMetadata.id, success: true });
          logger.info(`Successfully connected to MCP server: ${server.name} (${serverMetadata.id})`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to connect to MCP server ${server.name}:`, error);
          connectionResults.push({
            serverId: server.id,
            success: false,
            error: errorMessage,
          });
        }
      }

      return this.createSuccessResult(
        task.id,
        {
          discoveredServers: discoveredServers.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            score: evaluations.find(e => e.server.id === s.id)?.score || 0,
          })),
          connectedServers,
          connectionResults,
          capabilities: requiredCapabilities,
        },
        {
          evaluationsCount: evaluations.length,
          selectedCount: selectedServers.length,
          connectedCount: connectedServers.length,
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`MCPDiscoveryAgent error:`, error);
      return this.createFailureResult(task.id, errorMessage);
    }
  }

  /**
   * Determine required MCP server capabilities from task
   */
  private async determineRequiredCapabilities(task: Task): Promise<string[]> {
    // First check if task explicitly specifies required MCP servers
    if (task.requiredMCPServers && task.requiredMCPServers.length > 0) {
      // If specific servers are requested, we can infer capabilities
      // For now, return empty array - we'll search by server names
      return task.requiredMCPServers;
    }

    // Use LLM to analyze task and determine needed capabilities
    const llmHelpers = this.getLLMHelpers();
    if (this.llm.isAvailable() && llmHelpers) {
      try {
        const capabilities = await llmHelpers.determineRequiredMCPServers(task.description);
        logger.info(`LLM determined required capabilities: ${capabilities.join(', ')}`);
        return capabilities;
      } catch (error) {
        logger.warn('Error using LLM to determine capabilities, using fallback', error);
      }
    }

    // Fallback: extract keywords from task description
    const keywords = this.extractKeywords(task.description);
    logger.info(`Extracted keywords from task: ${keywords.join(', ')}`);
    return keywords;
  }

  /**
   * Extract keywords from task description
   */
  private extractKeywords(description: string): string[] {
    const keywords: string[] = [];
    const lowerDescription = description.toLowerCase();

    // Common capability keywords
    const capabilityKeywords: Record<string, string> = {
      file: 'file_operations',
      'file system': 'file_operations',
      read: 'file_operations',
      write: 'file_operations',
      git: 'git_operations',
      commit: 'git_operations',
      branch: 'git_operations',
      database: 'database_operations',
      db: 'database_operations',
      api: 'api_integration',
      http: 'api_integration',
      code: 'code_analysis',
      analyze: 'code_analysis',
      lint: 'code_analysis',
      document: 'documentation',
      css: 'stylesheet_operations',
      stylesheet: 'stylesheet_operations',
      scss: 'stylesheet_operations',
      style: 'stylesheet_operations',
      console: 'console_debugging',
      error: 'error_debugging',
      debug: 'error_debugging',
      network: 'network_debugging',
      browser: 'browser_tools',
      devtools: 'browser_tools',
      accessibility: 'accessibility_testing',
      wcag: 'accessibility_testing',
      aria: 'accessibility_testing',
      a11y: 'accessibility_testing',
      axe: 'accessibility_testing',
    };

    for (const [keyword, capability] of Object.entries(capabilityKeywords)) {
      if (lowerDescription.includes(keyword)) {
        keywords.push(capability);
      }
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Search for MCP servers
   */
  private async searchServers(capabilities: string[]): Promise<MCPServerDiscoveryResult[]> {
    logger.info(`Searching for MCP servers with capabilities: ${capabilities.join(', ')}`);

    // Search by capabilities
    const capabilityResults = await this.registrySearch.searchByCapabilities(capabilities);

    // Also search by keywords
    const keywordResults = await this.registrySearch.searchByKeyword(capabilities);

    // Combine and deduplicate
    const allResults = [...capabilityResults, ...keywordResults];
    const uniqueResults = this.deduplicateResults(allResults);

    logger.info(`Found ${uniqueResults.length} unique MCP servers`);
    return uniqueResults;
  }

  /**
   * Remove duplicate server results
   */
  private deduplicateResults(results: MCPServerDiscoveryResult[]): MCPServerDiscoveryResult[] {
    const seen = new Set<string>();
    const unique: MCPServerDiscoveryResult[] = [];

    for (const result of results) {
      const key = result.npmPackage || result.name;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Register a discovered server in the MCP manager
   */
  private async registerServer(
    discoveryResult: MCPServerDiscoveryResult
  ): Promise<MCPServerMetadata> {
    // Check if server is already registered
    const existingServers = this.mcpManager.getRegistry().getAllServers();
    const existing = existingServers.find(s => s.id === discoveryResult.id);

    if (existing) {
      logger.debug(`Server ${discoveryResult.id} already registered`);
      return existing;
    }

    // Create metadata from discovery result
    const metadata: MCPServerMetadata = {
      id: discoveryResult.id,
      name: discoveryResult.name,
      description: discoveryResult.description,
      version: discoveryResult.version,
      author: undefined,
      repository: discoveryResult.repository,
      npmPackage: discoveryResult.npmPackage,
      capabilities: discoveryResult.capabilities,
      status: 'disconnected',
      connectionType: 'stdio',
      connectionConfig: discoveryResult.connectionConfig,
      errorCount: 0,
    };

    // Register in MCP manager
    this.mcpManager.addServer(metadata);

    logger.info(`Registered MCP server: ${metadata.name} (${metadata.id})`);
    return metadata;
  }
}

