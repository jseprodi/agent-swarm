/**
 * Searches public MCP server registries
 */

import axios from 'axios';
import type { MCPServerDiscoveryResult } from '../types.js';
import logger from '../../utils/logger.js';

export interface MCPServerRegistryEntry {
  name: string;
  description?: string;
  version?: string;
  repository?: string;
  npmPackage?: string;
  capabilities?: {
    tools?: string[];
    resources?: string[];
    prompts?: string[];
  };
  connectionConfig?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  tags?: string[];
}

export class RegistrySearch {
  private npmRegistryUrl = 'https://registry.npmjs.org';
  private githubApiUrl = 'https://api.github.com';
  private knownMCPServers: MCPServerRegistryEntry[] = [];

  constructor() {
    // Initialize with some known MCP servers
    this.initializeKnownServers();
  }

  /**
   * Initialize with some well-known MCP servers
   */
  private initializeKnownServers(): void {
    // This would typically load from a registry API or database
    // For now, we'll populate with common examples
    this.knownMCPServers = [
      {
        name: 'filesystem',
        description: 'File system operations MCP server',
        npmPackage: '@modelcontextprotocol/server-filesystem',
        capabilities: {
          tools: ['read_file', 'write_file', 'list_directory'],
          resources: ['file://*'],
        },
        tags: ['filesystem', 'file', 'io'],
      },
      {
        name: 'git',
        description: 'Git operations MCP server',
        npmPackage: '@modelcontextprotocol/server-git',
        capabilities: {
          tools: ['git_status', 'git_commit', 'git_diff'],
        },
        tags: ['git', 'version-control'],
      },
      {
        name: 'browser-devtools',
        description: 'Browser DevTools MCP server for console and network debugging',
        npmPackage: '@modelcontextprotocol/server-devtools',
        capabilities: {
          tools: ['get_console_errors', 'get_console_logs', 'get_network_logs', 'execute_in_browser'],
        },
        tags: ['browser', 'devtools', 'debugging', 'console', 'network'],
      },
      {
        name: 'accessibility-checker',
        description: 'Accessibility testing MCP server using axe-core',
        npmPackage: '@modelcontextprotocol/server-accessibility',
        capabilities: {
          tools: ['run_accessibility_audit', 'check_wcag_compliance', 'test_keyboard_navigation'],
        },
        tags: ['accessibility', 'a11y', 'wcag', 'axe'],
      },
      {
        name: 'css-analyzer',
        description: 'CSS/SCSS analysis and optimization MCP server',
        npmPackage: '@modelcontextprotocol/server-css',
        capabilities: {
          tools: ['analyze_css', 'optimize_css', 'check_css_conflicts', 'minify_css'],
        },
        tags: ['css', 'stylesheet', 'scss', 'styling'],
      },
    ];
  }

  /**
   * Search for MCP servers by keyword
   */
  async searchByKeyword(keywords: string[]): Promise<MCPServerDiscoveryResult[]> {
    logger.info(`Searching for MCP servers with keywords: ${keywords.join(', ')}`);
    const results: MCPServerDiscoveryResult[] = [];

    // Search NPM registry
    const npmResults = await this.searchNPM(keywords);
    results.push(...npmResults);

    // Search known servers
    const knownResults = this.searchKnownServers(keywords);
    results.push(...knownResults);

    // Remove duplicates based on npm package or name
    const uniqueResults = this.deduplicateResults(results);

    logger.info(`Found ${uniqueResults.length} MCP servers matching keywords`);
    return uniqueResults;
  }

  /**
   * Search NPM registry for MCP-related packages
   */
  private async searchNPM(keywords: string[]): Promise<MCPServerDiscoveryResult[]> {
    const results: MCPServerDiscoveryResult[] = [];

    try {
      for (const keyword of keywords) {
        try {
          // Search for packages with "mcp" and keyword in name/description
          const searchQuery = `mcp ${keyword}`;
          const response = await axios.get(`${this.npmRegistryUrl}/-/v1/search`, {
            params: {
              text: searchQuery,
              size: 20,
            },
            timeout: 5000,
          });

          if (response.data?.objects) {
            for (const item of response.data.objects) {
              const pkg = item.package;
              if (pkg.name?.includes('mcp') || pkg.description?.includes('MCP')) {
                results.push({
                  id: `npm:${pkg.name}`,
                  name: pkg.name,
                  description: pkg.description,
                  version: pkg.version,
                  npmPackage: pkg.name,
                  repository: pkg.links?.repository || pkg.links?.npm,
                  capabilities: {},
                  connectionConfig: {
                    command: 'npx',
                    args: ['-y', pkg.name],
                  },
                  score: 0, // Will be scored by evaluator
                  tags: this.extractTags(pkg),
                });
              }
            }
          }
        } catch (error) {
          logger.warn(`Error searching NPM for keyword "${keyword}":`, error);
          // Continue with other keywords
        }
      }
    } catch (error) {
      logger.error('Error searching NPM registry:', error);
    }

    return results;
  }

  /**
   * Search known/curated MCP servers
   */
  private searchKnownServers(keywords: string[]): MCPServerDiscoveryResult[] {
    const results: MCPServerDiscoveryResult[] = [];
    const keywordLower = keywords.map(k => k.toLowerCase());

    for (const server of this.knownMCPServers) {
      const searchText = `${server.name} ${server.description || ''} ${server.tags?.join(' ') || ''}`.toLowerCase();
      
      const matches = keywordLower.some(keyword => searchText.includes(keyword));
      
      if (matches) {
        results.push({
          id: `known:${server.name}`,
          name: server.name,
          description: server.description,
          version: server.version,
          npmPackage: server.npmPackage,
          repository: server.repository,
          capabilities: server.capabilities || {},
          connectionConfig: server.connectionConfig || {
            command: 'npx',
            args: server.npmPackage ? ['-y', server.npmPackage] : [],
          },
          score: 0,
          tags: server.tags,
        });
      }
    }

    return results;
  }

  /**
   * Extract tags from package metadata
   */
  private extractTags(pkg: { keywords?: string[]; name?: string }): string[] {
    const tags: string[] = [];
    
    if (pkg.keywords) {
      tags.push(...pkg.keywords);
    }
    
    if (pkg.name) {
      // Extract meaningful parts from package name
      const parts = pkg.name.split(/[-_]/);
      tags.push(...parts.filter(p => p.length > 2 && p !== 'mcp'));
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Remove duplicate results
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
   * Search by required capabilities
   */
  async searchByCapabilities(requiredCapabilities: string[]): Promise<MCPServerDiscoveryResult[]> {
    logger.info(`Searching for MCP servers with capabilities: ${requiredCapabilities.join(', ')}`);
    
    // First search by capability keywords
    const results = await this.searchByKeyword(requiredCapabilities);

    // Filter results that actually have the required capabilities
    return results.filter(result => {
      const hasCapabilities = requiredCapabilities.every(cap => {
        return (
          result.capabilities.tools?.includes(cap) ||
          result.capabilities.resources?.some(r => r.includes(cap)) ||
          result.capabilities.prompts?.includes(cap)
        );
      });
      return hasCapabilities || result.name.toLowerCase().includes(requiredCapabilities[0]?.toLowerCase() || '');
    });
  }

  /**
   * Get server details from registry
   */
  async getServerDetails(serverId: string): Promise<MCPServerDiscoveryResult | null> {
    // Check if it's an NPM package
    if (serverId.startsWith('npm:')) {
      const packageName = serverId.replace('npm:', '');
      try {
        const response = await axios.get(`${this.npmRegistryUrl}/${packageName}`, {
          timeout: 5000,
        });

        const pkg = response.data?.versions?.[response.data['dist-tags']?.latest || Object.keys(response.data.versions || {})[0]];
        
        if (pkg) {
          return {
            id: serverId,
            name: pkg.name,
            description: pkg.description,
            version: pkg.version,
            npmPackage: pkg.name,
            repository: pkg.repository?.url,
            capabilities: {},
            connectionConfig: {
              command: 'npx',
              args: ['-y', pkg.name],
            },
            score: 0,
            tags: pkg.keywords || [],
          };
        }
      } catch (error) {
        logger.error(`Error fetching NPM package details for ${packageName}:`, error);
      }
    }

    // Check known servers
    const knownServer = this.knownMCPServers.find(s => `known:${s.name}` === serverId);
    if (knownServer) {
      return {
        id: serverId,
        name: knownServer.name,
        description: knownServer.description,
        version: knownServer.version,
        npmPackage: knownServer.npmPackage,
        repository: knownServer.repository,
        capabilities: knownServer.capabilities || {},
        connectionConfig: knownServer.connectionConfig || {
          command: 'npx',
          args: knownServer.npmPackage ? ['-y', knownServer.npmPackage] : [],
        },
        score: 0,
        tags: knownServer.tags,
      };
    }

    return null;
  }
}

