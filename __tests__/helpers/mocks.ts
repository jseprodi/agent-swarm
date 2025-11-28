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
    // Explicit check - throw error if available is false
    if (!this.available) {
      throw new Error('LLM provider is not available');
    }
    
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

/**
 * Mock Metrics Collector
 */
export class MockMetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  counter(name: string, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    return {
      inc: (amount: number = 1) => {
        this.counters.set(key, (this.counters.get(key) || 0) + amount);
      },
      getValue: () => this.counters.get(key) || 0,
      reset: () => this.counters.delete(key),
    };
  }

  gauge(name: string, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    return {
      set: (value: number) => this.gauges.set(key, value),
      getValue: () => this.gauges.get(key) || 0,
    };
  }

  histogram(name: string, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    return {
      observe: (value: number) => {
        const values = this.histograms.get(key) || [];
        values.push(value);
        this.histograms.set(key, values);
      },
      getStats: () => ({
        count: (this.histograms.get(key) || []).length,
        sum: (this.histograms.get(key) || []).reduce((a, b) => a + b, 0),
        mean: 0,
        min: 0,
        max: 0,
        percentiles: {},
      }),
    };
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join(',');
    return `${name}{${labelStr}}`;
  }
}

/**
 * Mock Cache
 */
export class MockCache<T = unknown> {
  private cache: Map<string, T> = new Map();

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Mock Health Monitor
 */
export class MockHealthMonitor {
  private status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  getStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    return this.status;
  }

  setStatus(status: 'healthy' | 'degraded' | 'unhealthy'): void {
    this.status = status;
  }

  performHealthCheck() {
    return {
      status: this.status,
      timestamp: Date.now(),
      components: [],
      summary: {
        agents: { total: 0, available: 0, busy: 0 },
        mcpServers: { total: 0, connected: 0, error: 0 },
        tasks: { total: 0, completed: 0, failed: 0, inProgress: 0 },
      },
    };
  }
}

/**
 * Mock Error Recovery Manager
 */
export class MockErrorRecoveryManager {
  async recoverTask(task: any, error: Error, agent: any, fallbacks: any[]): Promise<any> {
    // Mock implementation
    return null;
  }

  classifyError(error: Error): any {
    return {
      type: 'transient',
      shouldRetry: true,
      recoveryStrategy: 'retry',
    };
  }
}

/**
 * Mock Node Manager
 */
export class MockNodeManager {
  private nodes: Map<string, any> = new Map();

  registerNode(node: any): void {
    this.nodes.set(node.id, node);
  }

  getRegistry(): any {
    return {
      getAllNodes: () => Array.from(this.nodes.values()),
      getOnlineNodes: () => Array.from(this.nodes.values()).filter((n: any) => n.status === 'online'),
    };
  }
}

