/**
 * MCP-related types
 */

export type MCPServerStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPServerCapability {
  tools?: string[]; // Available tool names
  resources?: string[]; // Available resource URIs
  prompts?: string[]; // Available prompt templates
  custom?: Record<string, unknown>;
}

export interface MCPServerMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  repository?: string;
  npmPackage?: string;
  capabilities: MCPServerCapability;
  status: MCPServerStatus;
  connectionType: 'stdio' | 'http' | 'websocket';
  connectionConfig: MCPServerConnectionConfig;
  lastConnected?: Date;
  errorCount: number;
}

export interface MCPServerConnectionConfig {
  command?: string; // For stdio
  args?: string[];
  env?: Record<string, string>;
  url?: string; // For HTTP/WebSocket
  headers?: Record<string, string>;
}

export interface MCPServerDiscoveryResult {
  id: string;
  name: string;
  description?: string;
  version?: string;
  repository?: string;
  npmPackage?: string;
  capabilities: MCPServerCapability;
  connectionConfig: MCPServerConnectionConfig;
  score: number; // Relevance score for task requirements
  tags?: string[];
}

export interface MCPServerSearchCriteria {
  requiredCapabilities?: string[]; // Tools, resources, or prompts needed
  keywords?: string[];
  tags?: string[];
  maxResults?: number;
}

