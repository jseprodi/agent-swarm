/**
 * Mock implementations for testing
 */
import type { ILLMProvider, LLMRequest, LLMResponse } from '../../src/llm/types.js';
import type { Task, TaskResult } from '../../src/core/types.js';
import type { MCPServerClient } from '../../src/mcp/MCPServerClient.js';
import type { Agent } from '../../src/core/types.js';
/**
 * Mock LLM Provider for testing
 */
export declare class MockLLMProvider implements ILLMProvider {
    private responses;
    private defaultResponse;
    private available;
    constructor(available?: boolean);
    requestCompletion(request: LLMRequest): Promise<LLMResponse>;
    setResponse(prompt: string, response: LLMResponse, temperature?: number): void;
    setDefaultResponse(response: LLMResponse): void;
    isAvailable(): boolean;
    getName(): string;
    setAvailable(available: boolean): void;
}
/**
 * Mock MCP Server Client
 */
export declare class MockMCPServerClient implements Partial<MCPServerClient> {
    private connected;
    private capabilities;
    constructor(connected?: boolean);
    isConnected(): boolean;
    getCapabilities(): Record<string, unknown>;
    setCapabilities(capabilities: Record<string, unknown>): void;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    callTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
    setConnected(connected: boolean): void;
}
/**
 * Mock Agent for testing
 */
export declare class MockAgent implements Agent {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    private executeResult;
    private executeError;
    constructor(id?: string, name?: string, description?: string, capabilities?: string[]);
    getMetadata(): {
        id: string;
        name: string;
        description: string;
        capabilities: string[];
    };
    canHandle(task: Task): boolean;
    execute(task: Task): Promise<TaskResult>;
    setExecuteResult(result: TaskResult): void;
    setExecuteError(error: Error): void;
}
//# sourceMappingURL=mocks.d.ts.map