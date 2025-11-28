/**
 * MCP client finding utilities
 */

import type { MCPServerClient } from '../../mcp/MCPServerClient.js';

/**
 * Find console MCP server from clients map
 */
export function findConsoleMCP(mcpClients: Map<string, MCPServerClient>): string | undefined {
  for (const [serverId, client] of mcpClients.entries()) {
    const capabilities = client.getCapabilities();
    if (
      capabilities.tools?.some(tool =>
        ['get_console_errors', 'get_console_logs', 'console'].includes(tool)
      )
    ) {
      return serverId;
    }
  }
  return undefined;
}

/**
 * Find network MCP server from clients map
 */
export function findNetworkMCP(mcpClients: Map<string, MCPServerClient>): string | undefined {
  for (const [serverId, client] of mcpClients.entries()) {
    const capabilities = client.getCapabilities();
    if (
      capabilities.tools?.some(tool =>
        ['get_network_logs', 'network_request', 'http'].includes(tool)
      )
    ) {
      return serverId;
    }
  }
  return undefined;
}

/**
 * Find file operation MCP server from clients map
 */
export function findFileOperationMCP(mcpClients: Map<string, MCPServerClient>): string | undefined {
  for (const [serverId, client] of mcpClients.entries()) {
    const capabilities = client.getCapabilities();
    if (
      capabilities.tools?.some(tool =>
        ['read_file', 'write_file', 'list_directory'].includes(tool)
      )
    ) {
      return serverId;
    }
  }
  return undefined;
}

/**
 * Find accessibility MCP server from clients map
 */
export function findAccessibilityMCP(mcpClients: Map<string, MCPServerClient>): string | undefined {
  for (const [serverId, client] of mcpClients.entries()) {
    const capabilities = client.getCapabilities();
    if (
      capabilities.tools?.some(tool =>
        ['run_accessibility_audit', 'accessibility_test', 'axe', 'wcag'].includes(tool.toLowerCase())
      )
    ) {
      return serverId;
    }
  }
  return undefined;
}

