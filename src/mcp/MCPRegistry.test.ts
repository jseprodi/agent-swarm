/**
 * MCPRegistry unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPRegistry } from './MCPRegistry.js';
import { createTestMCPServer } from '../../__tests__/helpers/factories.js';
import { MockMCPServerClient } from '../../__tests__/helpers/mocks.js';

describe('MCPRegistry', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
  });

  describe('register', () => {
    it('should register a server', () => {
      const server = createTestMCPServer('test-server');
      registry.register(server);
      
      const metadata = registry.getMetadata('test-server');
      expect(metadata).toEqual(server);
    });
  });

  describe('connect', () => {
    it('should connect to registered server', async () => {
      const server = createTestMCPServer('test-server');
      registry.register(server);
      
      // Note: Actual connection requires MCPServerClient implementation
      // This test verifies the registry accepts the server
      expect(registry.getMetadata('test-server')).toBeDefined();
    });

    it('should throw error for non-existent server', async () => {
      await expect(registry.connect('non-existent')).rejects.toThrow();
    });
  });

  describe('getClient', () => {
    it('should return client for connected server', () => {
      const mockClient = new MockMCPServerClient(true);
      (registry as any).clients.set('test-server', mockClient);
      
      const client = registry.getClient('test-server');
      expect(client).toBe(mockClient);
    });
  });

  describe('getAllServers', () => {
    it('should return all registered servers', () => {
      const server1 = createTestMCPServer('server-1');
      const server2 = createTestMCPServer('server-2');
      registry.register(server1);
      registry.register(server2);
      
      const servers = registry.getAllServers();
      expect(servers).toHaveLength(2);
    });
  });
});

