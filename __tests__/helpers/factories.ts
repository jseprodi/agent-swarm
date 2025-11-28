/**
 * Factory functions for creating test data
 */

import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatus } from '../../src/core/types.js';
import type { MCPServerMetadata } from '../../src/mcp/types.js';
import type { Message, MessageType } from '../../src/communication/types.js';

/**
 * Create a test task
 */
export function createTestTask(
  description: string = 'Test task',
  status: TaskStatus = 'pending',
  overrides?: Partial<Task>
): Task {
  const task: Task = {
    id: uuidv4(),
    description,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return task;
}

/**
 * Create a test MCP server metadata
 */
export function createTestMCPServer(
  id: string = 'test-server',
  name: string = 'Test Server',
  overrides?: Partial<MCPServerMetadata>
): MCPServerMetadata {
  return {
    id,
    name,
    description: 'Test MCP server',
    version: '1.0.0',
    status: 'disconnected',
    connectionType: 'stdio',
    connectionConfig: {
      command: 'node',
      args: ['test-server.js'],
    },
    capabilities: {
      tools: ['test_tool'],
      resources: [],
      prompts: [],
    },
    errorCount: 0,
    ...overrides,
  };
}

/**
 * Create a test message
 */
export function createTestMessage(
  type: MessageType = 'task_completed',
  payload: unknown = {},
  overrides?: Partial<Message>
): Message {
  return {
    id: uuidv4(),
    type,
    payload,
    timestamp: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple test tasks
 */
export function createTestTasks(count: number, descriptionPrefix: string = 'Test task'): Task[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTask(`${descriptionPrefix} ${i + 1}`)
  );
}

