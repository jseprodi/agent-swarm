# Agent Swarm Architecture

This document provides a detailed overview of the Agent Swarm system architecture, components, and design decisions.

## Table of Contents

- [System Overview](#system-overview)
- [Core Components](#core-components)
- [Agent System](#agent-system)
- [MCP Integration](#mcp-integration)
- [LLM Provider System](#llm-provider-system)
- [Communication Layer](#communication-layer)
- [Task Management](#task-management)
- [Data Flow](#data-flow)
- [Design Patterns](#design-patterns)

## System Overview

Agent Swarm is a multi-agent system that uses LLM-powered orchestration to coordinate specialized agents for software development tasks. The system follows a hierarchical architecture with an orchestrator agent at the top level and domain-specific agents at the execution level.

```
┌─────────────────────────────────────────────────────────┐
│                    Swarm (Main Entry)                    │
│  - Initializes all components                            │
│  - Provides public API                                   │
│  - Manages lifecycle                                     │
└──────────────────┬──────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐        ┌──────▼──────┐
│ Orchestrator │        │ TaskManager │
│   Agent      │        │             │
└──────┬───────┘        └─────────────┘
       │
       │ Delegates to
       │
┌──────▼──────────────────────────────────────┐
│         Domain-Specific Agents               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Code   │  │   Test   │  │    Doc   │  │
│  │  Agent   │  │  Agent   │  │  Agent   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   MCP    │  │ Stylesheet│  │  Error   │  │
│  │Discovery │  │  Agent   │  │ Debugging│  │
│  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────┘
```

## Core Components

### Swarm Class

The main entry point that coordinates all system components.

**Responsibilities:**
- Initialize core components (TaskManager, MessageQueue, AgentRegistry, MCPManager)
- Configure LLM provider
- Register default agents
- Provide public API for task execution
- Manage system lifecycle

**Key Methods:**
- `execute(taskDescription, metadata)` - Execute a high-level task
- `getTaskManager()` - Access task management
- `getAgentRegistry()` - Access agent registry
- `cleanup()` - Cleanup resources

### Orchestrator Agent

The LLM-powered coordinator that breaks down tasks and delegates to sub-agents.

**Responsibilities:**
- Task decomposition using LLM
- Agent selection for subtasks
- Subtask execution coordination
- Result synthesis
- Dynamic agent creation (optional)

**Execution Flow:**
1. Analyze task requirements
2. Decompose into subtasks
3. Select appropriate agents
4. Execute subtasks (parallel when possible)
5. Synthesize results

### TaskManager

Centralized task tracking and dependency management.

**Responsibilities:**
- Create and track tasks
- Manage task status (pending, in_progress, completed, failed)
- Handle task dependencies
- Provide task querying

**Key Features:**
- Dependency resolution
- Status tracking
- Task history

### AgentRegistry

Manages agent registration and discovery.

**Responsibilities:**
- Register and unregister agents
- Find agents by capabilities
- Track agent availability
- Manage agent metadata

**Key Methods:**
- `register(agent)` - Register an agent
- `findAgents(capabilities)` - Find agents with capabilities
- `getAgent(id)` - Get agent by ID
- `getAllAgents()` - Get all registered agents

### MessageQueue

Asynchronous communication between agents.

**Responsibilities:**
- Publish messages
- Subscribe to message types
- Message history
- Event coordination

**Message Types:**
- `task_completed` - Task finished successfully
- `task_failed` - Task failed
- `agent_ready` - Agent became available
- `mcp_server_connected` - MCP server connected

## Agent System

### BaseAgent

Abstract base class for all agents.

**Common Features:**
- Agent metadata (id, name, description, capabilities)
- MCP client management
- Task execution interface
- Result creation helpers
- LLM integration

**Key Methods:**
- `execute(task)` - Execute a task (must be implemented)
- `canHandle(task)` - Check if agent can handle task
- `getMetadata()` - Get agent metadata
- `addMCPClient(serverId, client)` - Add MCP client
- `removeMCPClient(serverId)` - Remove MCP client

### Domain-Specific Agents

#### CodeAgent
- **Capabilities:** code_generation, code_modification, code_review
- **Purpose:** Generate, modify, and review code
- **Uses:** LLM for code generation, MCP for file operations

#### TestAgent
- **Capabilities:** test_generation, code_analysis
- **Purpose:** Generate unit and integration tests
- **Uses:** LLM for test generation

#### DocumentationAgent
- **Capabilities:** documentation, file_operations
- **Purpose:** Generate README, API docs, code comments
- **Uses:** LLM for documentation generation

#### MCPDiscoveryAgent
- **Capabilities:** mcp_discovery
- **Purpose:** Discover and connect to MCP servers
- **Uses:** RegistrySearch, ServerEvaluator, MCPManager

#### StylesheetAgent
- **Capabilities:** stylesheet_generation, stylesheet_analysis, file_operations
- **Purpose:** Generate, analyze, and optimize CSS/SCSS
- **Uses:** LLM for stylesheet generation

#### ErrorDebuggingAgent
- **Capabilities:** error_debugging, error_prevention, code_analysis
- **Purpose:** Debug console and network errors
- **Uses:** LLM for error analysis

#### AccessibilityAgent
- **Capabilities:** accessibility_testing, accessibility_implementation, code_analysis
- **Purpose:** Test WCAG compliance and implement accessibility
- **Uses:** LLM for accessibility analysis

#### DatabaseAgent
- **Capabilities:** database_operations, sql_generation
- **Purpose:** Database operations and SQL generation
- **Uses:** LLM for SQL generation

#### UnitTestAgent
- **Capabilities:** unit_test_generation, test_analysis, test_coverage
- **Purpose:** Specialized unit test generation
- **Uses:** LLM for unit test generation

### Dynamic Agents

Agents created at runtime with LLM-generated specifications.

**Features:**
- Created on-demand based on task requirements
- Configurable execution strategies (llm_direct, workflow, hybrid)
- Optional persistence for reuse
- Full agent capabilities

**Creation Flow:**
1. Orchestrator detects need for specialized agent
2. LLM generates agent specification
3. AgentFactory creates DynamicAgent
4. Agent registered in AgentRegistry
5. Agent used for task execution

## MCP Integration

### MCPManager

Manages MCP server connections and lifecycle.

**Responsibilities:**
- Server registration
- Connection management
- Health checks
- Capability discovery
- Error recovery

**Key Methods:**
- `addServer(metadata)` - Register server
- `connectServer(serverId)` - Connect to server
- `disconnectServer(serverId)` - Disconnect from server
- `findServersByCapability(capabilities)` - Find servers
- `getClient(serverId)` - Get connected client

### MCPRegistry

Internal registry for MCP servers.

**Responsibilities:**
- Store server metadata
- Manage connections
- Track server status
- Capability indexing

### MCPServerClient

Client interface for MCP server communication.

**Responsibilities:**
- Establish connection
- Call tools
- Access resources
- Handle prompts

### MCP Discovery

**Components:**
- `RegistrySearch` - Search public registries (NPM, GitHub)
- `ServerEvaluator` - Evaluate and rank discovered servers
- `MCPDiscoveryAgent` - Coordinate discovery process

**Discovery Flow:**
1. Analyze task for required capabilities
2. Search registries by capabilities/keywords
3. Evaluate and rank servers
4. Select best servers
5. Register and connect to servers

## LLM Provider System

### ILLMProvider Interface

Abstract interface for LLM providers.

**Methods:**
- `requestCompletion(request)` - Request LLM completion
- `isAvailable()` - Check if provider is available
- `getName()` - Get provider name

### BaseLLMProvider

Base class providing common functionality.

**Features:**
- Helper methods for common operations
- Token usage tracking
- Error handling
- Response parsing

### Provider Implementations

#### CursorLLMProvider
- Uses Cursor IDE's runtime LLM
- Auto-detects Cursor context
- No API key required

#### OpenAIProvider
- Supports GPT-4, GPT-3.5, and other models
- Requires API key
- Configurable model and parameters

#### AnthropicProvider
- Supports Claude models
- Requires API key
- Configurable model and parameters

## Communication Layer

### MessageQueue

Asynchronous message passing system.

**Features:**
- Type-based subscriptions
- Message history
- Event coordination
- Pub/sub pattern

**Message Format:**
```typescript
{
  id: string;
  type: MessageType;
  payload: unknown;
  timestamp: Date;
  sourceAgentId?: string;
}
```

### AgentRegistry

Central registry for agent management.

**Features:**
- Agent registration/discovery
- Capability-based lookup
- Availability tracking
- Metadata management

## Task Management

### Task Lifecycle

```
pending → in_progress → completed
                    ↓
                  failed
                    ↓
                cancelled
```

### Task Dependencies

Tasks can depend on other tasks. The system ensures:
- Dependencies complete before dependent tasks start
- Parallel execution when possible
- Dependency resolution
- Circular dependency detection

### Task Structure

```typescript
{
  id: string;
  description: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  parentTaskId?: string;
  assignedAgentId?: string;
  requiredCapabilities?: string[];
  requiredMCPServers?: string[];
  metadata?: Record<string, unknown>;
}
```

## Data Flow

### Task Execution Flow

```
1. User calls swarm.execute(taskDescription)
   ↓
2. Swarm creates root task in TaskManager
   ↓
3. Swarm delegates to Orchestrator
   ↓
4. Orchestrator decomposes task (using LLM)
   ↓
5. Orchestrator creates subtasks
   ↓
6. For each subtask:
   a. Find suitable agent
   b. Execute subtask
   c. Wait for dependencies if needed
   ↓
7. Orchestrator synthesizes results
   ↓
8. Return final result
```

### Agent Execution Flow

```
1. Agent receives task
   ↓
2. Agent checks if it can handle task
   ↓
3. Agent determines required MCP servers
   ↓
4. Agent requests MCP clients if needed
   ↓
5. Agent executes task logic
   ↓
6. Agent uses LLM if needed
   ↓
7. Agent uses MCP tools if needed
   ↓
8. Agent returns result
```

### MCP Server Connection Flow

```
1. Agent needs MCP server capability
   ↓
2. Check if server already connected
   ↓
3. If not, request from MCPManager
   ↓
4. MCPManager checks registry
   ↓
5. If not registered, trigger discovery
   ↓
6. MCPDiscoveryAgent searches registries
   ↓
7. Server registered and connected
   ↓
8. Client provided to agent
```

## Design Patterns

### Strategy Pattern

Used for:
- LLM provider selection
- Agent execution strategies (llm_direct, workflow, hybrid)
- Task decomposition strategies

### Factory Pattern

Used for:
- AgentFactory creates DynamicAgent instances
- LLM provider factory (implicit in Swarm initialization)

### Observer Pattern

Used for:
- MessageQueue subscriptions
- Task status updates
- Agent availability notifications

### Registry Pattern

Used for:
- AgentRegistry
- MCPRegistry
- TaskManager (task registry)

### Adapter Pattern

Used for:
- MCP server client abstraction
- LLM provider abstraction

## Performance Considerations

### Parallel Execution

- Subtasks execute in parallel when dependencies allow
- Configurable max concurrent tasks
- Dependency-aware scheduling

### Caching

- LLM responses can be cached (future enhancement)
- MCP server connections are reused
- Agent specifications are persisted

### Resource Management

- MCP server connections are pooled
- Tasks are cleaned up after completion
- Agents can be garbage collected when not in use

## Security Considerations

### API Authentication

- Optional API key authentication
- Rate limiting
- Input validation

### LLM Provider Security

- API keys stored in environment variables
- No keys in code or logs
- Secure transmission (HTTPS)

### MCP Server Security

- Server commands validated
- Sandboxed execution (future enhancement)
- Capability restrictions

## Extension Points

### Adding New Agents

1. Extend `BaseAgent`
2. Implement `execute(task)` method
3. Define capabilities
4. Register in Swarm initialization

### Adding New LLM Providers

1. Implement `ILLMProvider` interface
2. Extend `BaseLLMProvider` (optional)
3. Add to Swarm provider selection

### Adding MCP Servers

1. Create server metadata
2. Register with MCPManager
3. Connect when needed
4. Use via agent MCP clients

## Implemented Enhancements

### Agent-to-Agent Direct Communication

Agents can now communicate directly with each other without going through the orchestrator.

**Components:**
- Extended `MessageQueue` with `sendDirectMessage()`, `requestResponse()`, and `registerAgentHandler()`
- Added communication methods to `BaseAgent`: `sendMessageToAgent()`, `requestFromAgent()`, `subscribeToAgentMessages()`, `respondToMessage()`, `broadcastMessage()`
- New message types: `agent_request`, `agent_response`, `agent_broadcast`

**Usage:**
```typescript
// Send direct message
this.sendMessageToAgent('target-agent-id', 'agent_request', { data: 'value' });

// Request/response pattern
const response = await this.requestFromAgent('target-agent-id', 'agent_request', { data: 'value' });
```

### Distributed Agent Execution

Foundation for distributed execution across multiple nodes.

**Components:**
- `DistributedExecutor` - Remote agent proxy and task dispatcher
- `NodeManager` - Node discovery and health checking
- `NodeRegistry` - Registry of available nodes

**Note:** Full network transport implementation is pending. The infrastructure is in place for HTTP/WebSocket transport.

### Advanced Caching Strategies

Multi-level caching for LLM responses, task results, and agent computations.

**Components:**
- `CacheManager` - Base cache infrastructure with `MemoryCache`, `FileCache`, and `MultiLevelCache`
- `LLMCache` - Specialized caching for LLM responses with hit/miss tracking
- `TaskCache` - Caching for task execution results
- `CachedLLMProvider` - Wrapper that adds caching to any LLM provider

**Configuration:**
```typescript
const swarm = new Swarm({
  caching: {
    enabled: true,
    llmCache: { enabled: true, ttl: 3600000, maxSize: 500 },
    taskCache: { enabled: true, ttl: 1800000 },
    storage: 'hybrid',
    cacheDirectory: 'data/cache',
  },
});
```

### Performance Monitoring and Metrics

Comprehensive performance monitoring, metrics collection, and observability.

**Components:**
- `MetricsCollector` - Central metrics registry with Counter, Gauge, Histogram, and Timer
- `MetricsStore` - Time-series storage and aggregation
- `HealthMonitor` - System health monitoring with component health checks

**Metrics Types:**
- Counters: Task success/failure, agent operations
- Gauges: Current values (subtask count, agent availability)
- Histograms: Value distributions
- Timers: Execution durations

**API Endpoints:**
- `GET /api/stats/metrics` - All metrics
- `GET /api/stats/metrics/agents` - Agent-specific metrics
- `GET /api/stats/metrics/tasks` - Task performance metrics
- `GET /api/stats/metrics/llm` - LLM usage metrics
- `GET /api/stats/health` - Enhanced health check

### Enhanced Error Recovery

Sophisticated error recovery mechanisms including retry strategies, fallback agents, circuit breakers, and error pattern learning.

**Components:**
- `ErrorRecoveryManager` - Coordinates error recovery strategies
- `RetryStrategy` - Exponential backoff, fixed interval, and adaptive retry policies
- `CircuitBreaker` - Prevents cascading failures with open/closed/half-open states
- `ErrorPatternAnalyzer` - Analyzes error patterns for predictive recovery

**Configuration:**
```typescript
const swarm = new Swarm({
  errorRecovery: {
    enabled: true,
    maxRetries: 3,
    retryStrategy: 'exponential',
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 60000,
    },
    fallbackAgents: true,
  },
});
```

## Future Enhancements

- Agent learning and adaptation
- Full network transport implementation for distributed execution
- Advanced error pattern learning with ML

