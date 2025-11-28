/**
 * Core types for the Agent Swarm system
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type AgentCapability = 
  | 'code_generation'
  | 'code_modification'
  | 'test_generation'
  | 'documentation'
  | 'mcp_discovery'
  | 'file_operations'
  | 'git_operations'
  | 'code_analysis'
  | 'stylesheet_generation'
  | 'stylesheet_analysis'
  | 'error_debugging'
  | 'error_prevention'
  | 'accessibility_testing'
  | 'accessibility_implementation'
  | string; // Allow custom capabilities

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  dependencies?: string[]; // Task IDs this task depends on
  parentTaskId?: string; // For sub-tasks
  assignedAgent?: string;
  requiredCapabilities?: AgentCapability[];
  requiredMCPServers?: string[]; // MCP server identifiers needed
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
  mcpServersUsed?: string[];
  executionTime?: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  execute(task: Task): Promise<TaskResult>;
  canHandle(task: Task): boolean;
}

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  mcpServersUsed?: string[];
}

export interface OrchestratorMessage {
  id: string;
  type: 'task_assignment' | 'task_completed' | 'task_failed' | 'capability_request' | 'mcp_discovery_request';
  payload: unknown;
  timestamp: Date;
  sourceAgentId?: string;
  targetAgentId?: string;
}

export interface TaskDecomposition {
  tasks: Task[];
  dependencies: Map<string, string[]>; // Task ID -> dependent task IDs
  estimatedExecutionOrder: string[]; // Task IDs in execution order
}

