/**
 * Factory functions for creating test data
 */
import { v4 as uuidv4 } from 'uuid';
/**
 * Create a test task
 */
export function createTestTask(description = 'Test task', status = 'pending', overrides) {
    const task = {
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
export function createTestMCPServer(id = 'test-server', name = 'Test Server', overrides) {
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
export function createTestMessage(type = 'task_completed', payload = {}, overrides) {
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
export function createTestTasks(count, descriptionPrefix = 'Test task') {
    return Array.from({ length: count }, (_, i) => createTestTask(`${descriptionPrefix} ${i + 1}`));
}
//# sourceMappingURL=factories.js.map