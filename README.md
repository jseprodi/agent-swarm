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
- **MCP Integration**: Extensive use of MCP servers for capabilities like file operations, git, code analysis, external APIs, etc.
- **Communication Layer**: Message queue for orchestrator coordination, direct calls for sub-agent execution
- **Task Management**: Centralized tracking of all tasks and their dependencies

## Features

- **Pluggable LLM Integration**: Support for multiple LLM providers (Cursor, OpenAI, Anthropic) with easy customization
- **LLM-Powered Orchestration**: Intelligent task decomposition and agent selection using configured LLM provider
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

## API Reference

### Swarm Class

- `execute(taskDescription: string, metadata?: Record<string, unknown>): Promise<TaskResult>` - Execute a high-level task
- `getTaskManager(): TaskManager` - Get the task manager instance
- `getMessageQueue(): MessageQueue` - Get the message queue instance
- `getAgentRegistry(): AgentRegistry` - Get the agent registry
- `getMCPManager(): MCPManager` - Get the MCP manager
- `cleanup(): Promise<void>` - Cleanup resources

### Creating Custom Agents

```typescript
import { BaseAgent } from './src/core/Agent.js';
import type { Task, TaskResult } from './src/core/types.js';

export class MyCustomAgent extends BaseAgent {
  constructor(llm?: LLMIntegration) {
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

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

