/**
 * DatabaseAgent unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseAgent } from './DatabaseAgent.js';
import { MockLLMProvider } from '../../__tests__/helpers/mocks.js';
import { createTestTask } from '../../__tests__/helpers/factories.js';

describe('DatabaseAgent', () => {
  let agent: DatabaseAgent;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockLLM = new MockLLMProvider(true);
    agent = new DatabaseAgent(mockLLM);
  });

  describe('constructor', () => {
    it('should initialize with correct metadata', () => {
      const metadata = agent.getMetadata();
      expect(metadata.id).toBe('database-agent');
      expect(metadata.name).toBe('Database Agent');
      expect(metadata.capabilities).toContain('database_operations');
      expect(metadata.capabilities).toContain('query_generation');
      expect(metadata.capabilities).toContain('schema_design');
      expect(metadata.capabilities).toContain('migration_management');
    });
  });

  describe('execute', () => {
    it('should execute SQL query generation task', async () => {
      const task = createTestTask('Generate a SQL query to select all users');
      
      // Set default response that will match the agent's prompt
      mockLLM.setDefaultResponse({
        content: '```sql\nSELECT * FROM users WHERE id = 1;\n```\n\nThis query retrieves a user by ID.',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.databaseCode).toContain('SELECT');
        expect(data.databaseType).toBeDefined();
        expect(data.operationType).toBeDefined();
      }
    });

    it('should execute schema design task', async () => {
      const task = createTestTask('Create a database schema for a blog system');
      
      // Set default response that will match the agent's prompt
      mockLLM.setDefaultResponse({
        content: '```sql\nCREATE TABLE posts (\n  id SERIAL PRIMARY KEY,\n  title VARCHAR(255),\n  content TEXT\n);\n```\n\nSchema for blog system.',
        usage: { promptTokens: 15, completionTokens: 25, totalTokens: 40 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.databaseCode).toContain('CREATE TABLE');
        expect(data.operationType).toBe('schema_design');
      }
    });

    it('should execute migration script task', async () => {
      const task = createTestTask('Create a migration to add a new column to the users table');
      
      // Set default response that will match the agent's prompt
      mockLLM.setDefaultResponse({
        content: '```sql\nALTER TABLE users ADD COLUMN email VARCHAR(255);\n```\n\nMigration to add email column.',
        usage: { promptTokens: 12, completionTokens: 18, totalTokens: 30 },
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        expect(data.databaseCode).toContain('ALTER TABLE');
        expect(data.operationType).toBe('migration');
      }
    });

    it('should handle task with database context', async () => {
      const task = createTestTask('Generate a query', 'pending', {
        databaseContext: 'Table: users (id, name, email)',
        databaseType: 'postgresql',
      });
      
      const result = await agent.execute(task);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Create a new mock LLM that's unavailable
      const unavailableLLM = new MockLLMProvider(false);
      const errorAgent = new DatabaseAgent(unavailableLLM);
      const task = createTestTask('Generate a query');
      
      const result = await errorAgent.execute(task);
      
      expect(result).toBeDefined();
      // The agent should handle the error and return a failure result
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with database_operations capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['database_operations'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should handle tasks with query_generation capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['query_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should handle tasks with schema_design capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['schema_design'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should handle tasks with migration_management capability', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['migration_management'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks without required capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['code_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(false);
    });

    it('should handle tasks with multiple database capabilities', () => {
      const task = createTestTask('Task', 'pending', {
        requiredCapabilities: ['database_operations', 'query_generation'],
      });
      
      expect(agent.canHandle(task)).toBe(true);
    });
  });
});

