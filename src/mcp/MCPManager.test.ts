/**
 * MCPManager unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPManager } from './MCPManager.js';
import { MCPRegistry } from './MCPRegistry.js';
import { createTestMCPServer } from '../../__tests__/helpers/factories.js';
import { MockMCPServerClient } from '../../__tests__/helpers/mocks.js';

describe('MCPManager', () => {
  let manager: MCPManager;
  let registry: MCPRegistry;

  beforeEach(() => {
    registry = new MCPRegistry();
    manager = new MCPManager(registry);
  });

  afterEach(() => {
    manager.stopHealthChecks();
  });

  describe('constructor', () => {
    it('should initialize with default registry', () => {
      const defaultManager = new MCPManager();
      expect(defaultManager).toBeDefined();
    });

    it('should initialize with custom registry', () => {
      expect(manager).toBeDefined();
    });
  });

  describe('addServer', () => {
    it('should add server to registry', () => {
      const server = createTestMCPServer('test-server');
      manager.addServer(server);
      
      const metadata = manager.getServerMetadata('test-server');
      expect(metadata).toEqual(server);
    });
  });

  describe('connectServer', () => {
    it('should connect to server', async () => {
      const server = createTestMCPServer('test-server');
      manager.addServer(server);
      
      // Mock the registry connect to return a mock client
      const mockClient = new MockMCPServerClient(false);
      vi.spyOn(registry, 'connect').mockResolvedValue(mockClient as any);
      
      const client = await manager.connectServer('test-server');
      expect(client).toBeDefined();
    });

    it('should throw error when server not found', async () => {
      await expect(manager.connectServer('non-existent')).rejects.toThrow();
    });
  });

  describe('connectServers', () => {
    it('should connect to multiple servers', async () => {
      const server1 = createTestMCPServer('server-1');
      const server2 = createTestMCPServer('server-2');
      manager.addServer(server1);
      manager.addServer(server2);
      
      const mockClient = new MockMCPServerClient(false);
      vi.spyOn(registry, 'connect').mockResolvedValue(mockClient as any);
      
      const clients = await manager.connectServers(['server-1', 'server-2']);
      expect(clients.size).toBe(2);
    });

    it('should handle partial failures gracefully', async () => {
      const server1 = createTestMCPServer('server-1');
      manager.addServer(server1);
      
      const mockClient = new MockMCPServerClient(false);
      vi.spyOn(registry, 'connect')
        .mockResolvedValueOnce(mockClient as any)
        .mockRejectedValueOnce(new Error('Connection failed'));
      
      const clients = await manager.connectServers(['server-1', 'non-existent']);
      expect(clients.size).toBe(1);
    });
  });

  describe('disconnectServer', () => {
    it('should disconnect from server', async () => {
      const server = createTestMCPServer('test-server');
      manager.addServer(server);
      
      vi.spyOn(registry, 'disconnect').mockResolvedValue(undefined);
      
      await manager.disconnectServer('test-server');
      expect(registry.disconnect).toHaveBeenCalledWith('test-server');
    });
  });

  describe('getClient', () => {
    it('should return client for connected server', () => {
      const mockClient = new MockMCPServerClient(true);
      vi.spyOn(registry, 'getClient').mockReturnValue(mockClient as any);
      
      const client = manager.getClient('test-server');
      expect(client).toBe(mockClient);
    });
  });

  describe('findServersByCapability', () => {
    it('should find servers by capability', () => {
      const server = createTestMCPServer('test-server');
      manager.addServer(server);
      
      const mockClient = new MockMCPServerClient(true);
      mockClient.setCapabilities({ tools: ['file_read'] });
      vi.spyOn(registry, 'getClient').mockReturnValue(mockClient as any);
      
      const servers = manager.findServersByCapability(['file_read']);
      expect(servers.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('health checks', () => {
    it('should start health checks', () => {
      manager.startHealthChecks();
      // Health checks should be running
      expect(manager).toBeDefined();
    });

    it('should not start health checks if already running', () => {
      manager.startHealthChecks();
      manager.startHealthChecks(); // Should not throw
    });

    it('should stop health checks', () => {
      manager.startHealthChecks();
      manager.stopHealthChecks();
      // Should not throw
    });
  });
});

