/**
 * Communication layer types
 */

export type MessageType = 
  | 'task_assignment'
  | 'task_completed'
  | 'task_failed'
  | 'capability_request'
  | 'mcp_discovery_request'
  | 'agent_ready'
  | 'agent_busy'
  | 'error';

export interface Message {
  id: string;
  type: MessageType;
  payload: unknown;
  timestamp: Date;
  sourceAgentId?: string;
  targetAgentId?: string;
  correlationId?: string; // For request/response matching
}

export interface AgentRegistration {
  agentId: string;
  capabilities: string[];
  mcpServersUsed?: string[];
  isAvailable: boolean;
}

