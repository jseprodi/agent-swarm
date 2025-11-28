/**
 * Mock implementations for testing
 */

import type { ILLMProvider, LLMRequest, LLMResponse } from '../../src/llm/types.js';
import type { Task, TaskResult } from '../../src/core/types.js';
import type { MCPServerMetadata } from '../../src/mcp/types.js';
import type { MCPServerClient } from '../../src/mcp/MCPServerClient.js';
import type { Agent } from '../../src/core/types.js';
import { BaseLLMProvider } from '../../src/llm/BaseLLMProvider.js';

/**
 * Mock LLM Provider for testing - extends BaseLLMProvider to get helper methods
 */
export class MockLLMProvider extends BaseLLMProvider {
  private responses: Map<string, LLMResponse> = new Map();
  private defaultResponse: LLMResponse = {
    content: '{"subtasks": [{"description": "Mock subtask", "agent": "code-agent"}], "reasoning": "Mock decomposition"}',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
  };
  private available: boolean = true;

  constructor(available: boolean = true) {
    super();
    this.available = available;
  }

  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    const key = `${request.prompt.substring(0, 50)}_${request.temperature || 0.7}`;
    const response = this.responses.get(key) || this.defaultResponse;
    // If it's a decomposition request, return JSON
    if (request.prompt.includes('break it down') || request.prompt.includes('decompose')) {
      return {
        content: '{"subtasks": [{"description": "' + request.prompt.substring(0, 50) + '", "agent": "code-agent"}], "reasoning": "Mock decomposition"}',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }
    // If it's an agent selection request, return array
    if (request.prompt.includes('select') || request.prompt.includes('agent')) {
      return {
        content: '["code-agent"]',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }
    // If it's MCP server determination, return empty array
    if (request.prompt.includes('MCP server') || request.prompt.includes('capabilities')) {
      return {
        content: '[]',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };
    }
    return response;
  }

  setResponse(prompt: string, response: LLMResponse, temperature?: number): void {
    const key = `${prompt.substring(0, 50)}_${temperature || 0.7}`;
    this.responses.set(key, response);
  }

  setDefaultResponse(response: LLMResponse): void {
    this.defaultResponse = response;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getName(): string {
    return 'Mock';
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }
}

/**
 * Mock MCP Server Client
 */
export class MockMCPServerClient implements Partial<MCPServerClient> {
  private connected: boolean = false;
  private capabilities: Record<string, unknown> = {};

  constructor(connected: boolean = false) {
    this.connected = connected;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getCapabilities(): Record<string, unknown> {
    return this.capabilities;
  }

  setCapabilities(capabilities: Record<string, unknown>): void {
    this.capabilities = capabilities;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    return { result: `Mock tool result for ${toolName}` };
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }
}

/**
 * Mock Agent for testing
 */
export class MockAgent implements Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  private executeResult: TaskResult | null = null;
  private executeError: Error | null = null;

  constructor(
    id: string = 'mock-agent',
    name: string = 'Mock Agent',
    description: string = 'Mock agent for testing',
    capabilities: string[] = ['test']
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.capabilities = capabilities;
  }

  getMetadata() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      capabilities: this.capabilities,
    };
  }

  canHandle(task: Task): boolean {
    // Check capabilities
    if (task.requiredCapabilities && task.requiredCapabilities.length > 0) {
      const hasAll = task.requiredCapabilities.every(cap => this.capabilities.includes(cap));
      if (!hasAll) return false;
    }
    // For MCP servers, always return true in mock (tests can override behavior)
    return true;
  }

  async execute(task: Task): Promise<TaskResult> {
    if (this.executeError) {
      throw this.executeError;
    }
    return (
      this.executeResult || {
        taskId: task.id,
        success: true,
        data: { message: 'Mock execution result' },
      }
    );
  }

  setExecuteResult(result: TaskResult): void {
    this.executeResult = result;
  }

  setExecuteError(error: Error): void {
    this.executeError = error;
  }
}

