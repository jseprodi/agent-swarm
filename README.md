# Agent Swarm

A TypeScript-based Agent Swarm system with an LLM-powered orchestrator that manages domain-specific sub-agents for software development tasks. The system extensively uses MCP (Model Context Protocol) servers discovered and connected by a dedicated discovery agent.

## Architecture

The Agent Swarm system consists of:

- **Orchestrator Agent**: LLM-powered coordinator that receives high-level tasks, breaks them down, and delegates to sub-agents (uses Cursor's LLM integration at runtime)
- **Sub-Agents**: Domain-specific agents that perform focused tasks:
  - `CodeAgent`: Generates, modifies, and reviews code
  - `TestAgent`: Writes unit tests and integration tests
  - `DocumentationAgent`: Generates README files, API docs, and code comments
  - `MCPDiscoveryAgent`: Discovers and connects to publicly registered MCP servers
- **Dynamic Agent Creation**: Orchestrator can automatically create specialized agents when it identifies a need during task decomposition or when no suitable agent exists
- **MCP Integration**: Extensive use of MCP servers for capabilities like file operations, git, code analysis, external APIs, etc.
- **Communication Layer**: Message queue for orchestrator coordination, direct calls for sub-agent execution
- **Task Management**: Centralized tracking of all tasks and their dependencies

## Features

- **Pluggable LLM Integration**: Support for multiple LLM providers (Cursor, OpenAI, Anthropic) with easy customization
- **LLM-Powered Orchestration**: Intelligent task decomposition and agent selection using configured LLM provider
- **Dynamic Agent Creation**: Automatically creates specialized agents when needed, with optional persistence for reuse
- **MCP-First Architecture**: System extensively leverages MCP servers for capabilities; agents prefer MCP servers over direct implementations
- **Automatic MCP Discovery**: Dedicated agent finds and connects to publicly registered MCP servers based on task requirements
- **Extensible**: Easy to add new domain-specific agents and LLM providers; MCP servers extend capabilities dynamically
- **Type-Safe**: Full TypeScript typing for all interfaces and types
- **Task Dependency Management**: Centralized tracking with automatic dependency resolution

## Installation

```bash
npm install
```

## Quick Start

### Development Mode

Start all services in development mode:

**Windows (PowerShell):**
```powershell
.\scripts\start-dev.ps1
```

**Windows (Command Prompt):**
```cmd
scripts\start-dev.bat
```

**Linux/Mac:**
```bash
chmod +x scripts/*.sh
./scripts/start-dev.sh
```

**NPM:**
```bash
npm run dev
```

This will start:
- Core system (TypeScript watch mode)
- API server on http://localhost:3000
- Web UI on http://localhost:5173

### Production Mode

Build and start all services:

**Windows (PowerShell):**
```powershell
.\scripts\start-prod.ps1
```

**NPM:**
```bash
npm run build
npm run start
```

See [scripts/README.md](scripts/README.md) for detailed script documentation.

## Usage

### Basic Example

```typescript
import { Swarm } from './src/index.js';

// Initialize the swarm with Cursor LLM (default)
const swarm = new Swarm({
  enableHealthChecks: true,
  logLevel: 'info',
});

// Execute a task
const result = await swarm.execute(
  'Generate a TypeScript function that calculates the factorial of a number'
);

if (result.success) {
  console.log('Task completed:', result.data);
} else {
  console.error('Task failed:', result.error);
}

// Cleanup
await swarm.cleanup();
```

### Using Different LLM Providers

The system supports multiple LLM providers. You can configure which one to use:

#### OpenAI Provider

```typescript
import { Swarm } from './src/index.js';

const swarm = new Swarm({
  llmProvider: 'openai',
  llmConfig: {
    apiKey: process.env.OPENAI_API_KEY, // Or set OPENAI_API_KEY env var
    model: 'gpt-4-turbo-preview',
    temperature: 0.7,
  },
});
```

#### Anthropic (Claude) Provider

```typescript
import { Swarm } from './src/index.js';

const swarm = new Swarm({
  llmProvider: 'anthropic',
  llmConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY, // Or set ANTHROPIC_API_KEY env var
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
  },
});
```

#### Cursor Provider (Default)

```typescript
import { Swarm } from './src/index.js';

// Cursor provider is used by default when running in Cursor context
const swarm = new Swarm({
  llmProvider: 'cursor', // Optional, this is the default
});
```

#### Custom LLM Provider

You can also provide your own LLM provider instance:

```typescript
import { Swarm } from './src/index.js';
import { ILLMProvider } from './src/llm/types.js';
import { BaseLLMProvider } from './src/llm/BaseLLMProvider.js';

class MyCustomLLMProvider extends BaseLLMProvider {
  async requestCompletion(request: LLMRequest): Promise<LLMResponse> {
    // Your custom implementation
  }
  
  isAvailable(): boolean {
    return true;
  }
  
  getName(): string {
    return 'MyCustom';
  }
}

const swarm = new Swarm({
  llmProvider: new MyCustomLLMProvider(),
});
```

### Complex Multi-Agent Task

```typescript
const result = await swarm.execute(
  'Create a complete utility library with a factorial function, unit tests, and documentation',
  {
    libraryName: 'math-utils',
    functions: ['factorial', 'fibonacci'],
  }
);
```

### Task with MCP Server Discovery

```typescript
const result = await swarm.execute(
  'Read a file, analyze its contents, and generate a summary using file operations',
  {
    filePath: 'example.txt',
  }
);
```

### Dynamic Agent Creation

The orchestrator can automatically create specialized agents when it identifies a need. Enable this feature in your configuration:

```typescript
import { Swarm } from './src/index.js';

const swarm = new Swarm({
  dynamicAgents: {
    enabled: true,
    maxDynamicAgents: 10, // Limit number of agents created
    agentCreationThreshold: 0.5, // Complexity threshold (0-1)
    defaultPersistence: {
      persist: true,
      persistConfig: true, // Save agent specifications to disk
      persistCode: false, // Code generation not currently used
    },
    persistenceDirectory: 'data/agents/dynamic', // Where to save agents
  },
});

// Execute a task - if no suitable agent exists, one will be created automatically
const result = await swarm.execute(
  'Create a specialized data visualization component with D3.js'
);
```

Dynamic agents are created in two scenarios:
1. **During task decomposition**: When the orchestrator identifies that a subtask would benefit from a specialized agent
2. **When no agent is found**: If no existing agent can handle a subtask, a new one is created automatically

You can also control persistence per-task:

```typescript
const result = await swarm.execute(
  'Generate a custom API client for a REST service',
  {
    agentPersistence: {
      persist: true,
      persistConfig: true,
      persistCode: false,
    },
  }
);
```

## Project Structure

```
swarm/
├── src/
│   ├── core/               # Core orchestration and task management
│   ├── agents/             # Domain-specific agents
│   ├── mcp/                # MCP server integration
│   ├── communication/      # Message queue and agent registry
│   ├── cursor/             # Cursor LLM integration
│   ├── utils/              # Utilities
│   └── index.ts            # Main entry point
├── examples/               # Usage examples
└── README.md
```

## Development

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## MCP Server Integration

The system automatically discovers and connects to MCP servers based on task requirements. The `MCPDiscoveryAgent`:

1. Analyzes task requirements to determine needed capabilities
2. Searches public registries (NPM, GitHub, etc.) for relevant servers
3. Evaluates and ranks discovered servers
4. Connects to selected servers via the MCP Manager
5. Reports discovered capabilities to the orchestrator

### Supported MCP Servers

The system can discover and use any MCP-compatible server. Common examples include:

- File system operations servers
- Git operations servers
- Database servers
- API integration servers
- Code analysis servers

## LLM Provider System

The system supports multiple LLM providers through a pluggable interface. You can use:

- **Cursor**: Uses Cursor's runtime LLM when available (default)
- **OpenAI**: GPT-4, GPT-3.5, and other OpenAI models
- **Anthropic**: Claude models (Claude 3.5 Sonnet, etc.)
- **Custom**: Implement your own provider by extending `BaseLLMProvider`

All providers support:
- Task decomposition
- Agent selection
- Code generation
- Documentation generation
- MCP server requirement analysis

When using Cursor provider, it automatically detects if running in Cursor's context. Other providers require API keys via configuration or environment variables.

## Configuration

The `Swarm` class accepts a configuration object:

```typescript
interface SwarmConfig {
  enableHealthChecks?: boolean;      // Enable MCP server health checks
  healthCheckInterval?: number;      // Health check interval in ms
  logLevel?: string;                 // Logging level (debug, info, warn, error)
  llmProvider?: 'cursor' | 'openai' | 'anthropic' | ILLMProvider;  // LLM provider to use
  llmConfig?: LLMProviderConfig;     // LLM provider configuration
  dynamicAgents?: DynamicAgentConfig; // Dynamic agent creation configuration
}
```

### Dynamic Agent Configuration

```typescript
interface DynamicAgentConfig {
  enabled: boolean;                  // Enable/disable dynamic agent creation
  maxDynamicAgents?: number;         // Maximum number of dynamic agents to create (default: 10)
  agentCreationThreshold?: number;   // Complexity threshold 0-1 (default: 0.5)
  defaultPersistence?: {             // Default persistence options
    persist: boolean;
    persistConfig?: boolean;         // Save agent specifications
    persistCode?: boolean;           // Save generated code (future use)
  };
  persistenceDirectory?: string;     // Directory for persisted agents (default: 'data/agents/dynamic')
}
```

### LLM Provider Configuration

```typescript
interface LLMProviderConfig {
  apiKey?: string;        // API key (can also use environment variables)
  model?: string;         // Model name (provider-specific)
  baseURL?: string;       // Custom base URL for API
  temperature?: number;   // Default temperature (0-1)
  maxTokens?: number;     // Maximum tokens in response
  timeout?: number;       // Request timeout in ms
}
```

#### Environment Variables

You can also set LLM provider API keys via environment variables:
- `OPENAI_API_KEY` - For OpenAI provider
- `ANTHROPIC_API_KEY` - For Anthropic provider

## Dynamic Agent Creation

The orchestrator can automatically create specialized agents when it recognizes a need. This feature uses LLM-powered analysis to:

1. **Detect Missing Capabilities**: Analyzes tasks to identify if a specialized agent would be beneficial
2. **Generate Agent Specifications**: Creates complete agent specifications including:
   - Name and description
   - Required capabilities
   - Execution strategy (LLM direct, workflow, or hybrid)
   - Prompt templates and workflow steps
   - Output format preferences
3. **Create and Register Agents**: Instantiates agents and registers them in the agent registry
4. **Optional Persistence**: Saves agent specifications to disk for reuse across sessions

### How It Works

When a task is executed:
1. The orchestrator decomposes the task into subtasks
2. For each subtask, it checks if a suitable agent exists
3. If no agent is found and dynamic agents are enabled:
   - The LLM analyzes whether creating a specialized agent would be beneficial
   - If yes, it generates a complete agent specification
   - A `DynamicAgent` is created with the specification
   - The agent is registered and used for the task
4. Optionally, the agent specification is saved to disk for future use

### Agent Execution Strategies

Dynamic agents support three execution strategies:

- **llm_direct**: Direct LLM interaction with custom prompts
- **workflow**: Multi-step workflow with defined steps
- **hybrid**: Combines LLM analysis with workflow execution

### Persistence

Agent specifications are saved as JSON files in the configured directory. On startup, persisted agents are automatically loaded and registered. This allows agents created in previous sessions to be reused.

## API Reference

### Swarm Class

- `execute(taskDescription: string, metadata?: Record<string, unknown>): Promise<TaskResult>` - Execute a high-level task
- `getTaskManager(): TaskManager` - Get the task manager instance
- `getMessageQueue(): MessageQueue` - Get the message queue instance
- `getAgentRegistry(): AgentRegistry` - Get the agent registry
- `getMCPManager(): MCPManager` - Get the MCP manager
- `getOrchestrator(): Orchestrator` - Get the orchestrator instance
- `cleanup(): Promise<void>` - Cleanup resources

### Creating Custom Agents

You can create custom agents by extending `BaseAgent`:

```typescript
import { BaseAgent } from './src/core/Agent.js';
import type { Task, TaskResult } from './src/core/types.js';

export class MyCustomAgent extends BaseAgent {
  constructor(llm?: ILLMProvider) {
    super(
      'my-custom-agent',
      'My Custom Agent',
      'Description of what this agent does',
      ['capability1', 'capability2'],
      llm
    );
  }

  async execute(task: Task): Promise<TaskResult> {
    // Implement your agent logic here
    return this.createSuccessResult(task.id, { /* result data */ });
  }
}
```

### Working with Dynamic Agents

You can also work directly with the dynamic agent system:

```typescript
import { AgentFactory, DynamicAgent } from './src/agents/index.js';
import type { AgentSpecification } from './src/core/types.js';

// Create an agent factory
const factory = new AgentFactory(agentRegistry, llm);

// Create a dynamic agent from a specification
const spec: AgentSpecification = {
  name: 'Data Processing Agent',
  description: 'Specialized agent for processing and transforming data',
  capabilities: ['data_processing', 'data_transformation'],
  behavior: {
    executionStrategy: 'workflow',
    workflowSteps: [
      { step: 'validate', description: 'Validate input data', action: 'Check data format' },
      { step: 'transform', description: 'Transform data', action: 'Apply transformations' },
    ],
    outputFormat: 'json',
  },
};

const agent = await factory.createDynamicAgent(spec, {
  persist: true,
  persistConfig: true,
});
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

