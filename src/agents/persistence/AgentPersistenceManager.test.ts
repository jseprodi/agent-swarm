/**
 * AgentPersistenceManager unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentPersistenceManager } from './AgentPersistenceManager.js';
import type { AgentSpecification, AgentPersistenceOptions } from '../../../core/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('AgentPersistenceManager', () => {
  let manager: AgentPersistenceManager;
  let testDirectory: string;

  beforeEach(() => {
    testDirectory = 'test-data/agents';
    manager = new AgentPersistenceManager(testDirectory);
    vi.clearAllMocks();
  });

  describe('saveSpecification', () => {
    it('should save specification when persistConfig is true', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const options: AgentPersistenceOptions = {
        persist: true,
        persistConfig: true,
        persistCode: false,
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await manager.saveSpecification('test-agent', specification, options);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeCall[0]).toContain('test-agent.json');
    });

    it('should not save when persistConfig is false', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const options: AgentPersistenceOptions = {
        persist: true,
        persistConfig: false,
        persistCode: false,
      };

      await manager.saveSpecification('test-agent', specification, options);

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('loadSpecification', () => {
    it('should load specification from file', async () => {
      const specification: AgentSpecification = {
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['test'],
        behavior: {
          executionStrategy: 'llm_direct',
          outputFormat: 'json',
        },
        createdAt: new Date(),
      };

      const fileContent = JSON.stringify({
        ...specification,
        agentId: 'test-agent',
        savedAt: new Date().toISOString(),
      });

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue(fileContent);

      const loaded = await manager.loadSpecification('test-agent');

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Test Agent');
    });

    it('should return null if file does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const loaded = await manager.loadSpecification('non-existent');

      expect(loaded).toBeNull();
    });
  });

  describe('listPersistedAgents', () => {
    it('should list all persisted agent IDs', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['agent1.json', 'agent2.json', 'other.txt'] as any);

      const agents = await manager.listPersistedAgents();

      expect(agents).toEqual(['agent1', 'agent2']);
    });

    it('should return empty array if directory is empty', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([] as any);

      const agents = await manager.listPersistedAgents();

      expect(agents).toEqual([]);
    });
  });

  describe('deleteSpecification', () => {
    it('should delete specification file', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      await manager.deleteSpecification('test-agent');

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should handle file not found gracefully', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      await expect(manager.deleteSpecification('non-existent')).resolves.not.toThrow();
    });
  });
});

