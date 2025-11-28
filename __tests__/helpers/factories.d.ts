/**
 * Factory functions for creating test data
 */
import type { Task, TaskStatus } from '../../src/core/types.js';
import type { MCPServerMetadata } from '../../src/mcp/types.js';
import type { Message, MessageType } from '../../src/communication/types.js';
/**
 * Create a test task
 */
export declare function createTestTask(description?: string, status?: TaskStatus, overrides?: Partial<Task>): Task;
/**
 * Create a test MCP server metadata
 */
export declare function createTestMCPServer(id?: string, name?: string, overrides?: Partial<MCPServerMetadata>): MCPServerMetadata;
export declare function createTestMessage(type?: MessageType, payload?: unknown, overrides?: Partial<Message>): Message;
/**
 * Create multiple test tasks
 */
export declare function createTestTasks(count: number, descriptionPrefix?: string): Task[];
//# sourceMappingURL=factories.d.ts.map