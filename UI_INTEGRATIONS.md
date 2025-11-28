# UI and IDE Integrations

This document describes the UI and IDE integration packages for Agent Swarm.

## Packages Overview

### 1. API Server (`packages/api-server`)
REST/WebSocket API server that provides the backend for all UI interfaces.

**Features:**
- REST API endpoints for tasks, agents, MCP servers, and configuration
- WebSocket server for real-time updates
- Express.js based with TypeScript

**Usage:**
```bash
cd packages/api-server
npm install
npm run build
npm start
```

### 2. Web UI (`packages/web-ui`)
React-based web dashboard for comprehensive system management.

**Features:**
- Task management interface
- Agent monitoring dashboard
- MCP server management
- Configuration interface
- Real-time updates via WebSocket

**Usage:**
```bash
cd packages/web-ui
npm install
npm run dev
```

### 3. CLI (`packages/cli`)
Command-line interface for quick tasks and automation.

**Features:**
- Task creation and management
- Agent status checking
- MCP server management
- System status reporting

**Usage:**
```bash
cd packages/cli
npm install
npm run build
npm link  # Link globally
swarm task create "Generate a function"
swarm status
```

### 4. VS Code Extension (`packages/vscode-extension`)
Native VS Code integration.

**Features:**
- Sidebar panels for tasks and agents
- Command palette integration
- Real-time status updates

### 5. Cursor Extension (`packages/cursor-extension`)
Native Cursor IDE integration.

**Features:**
- Similar to VS Code extension
- Adapted for Cursor's environment

### 6. IntelliJ Plugin (`packages/intellij-plugin`)
IntelliJ IDEA plugin (Kotlin-based).

**Features:**
- Tool window for Agent Swarm
- Task creation actions
- Status monitoring

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- For IntelliJ plugin: IntelliJ IDEA with Gradle

### Quick Start

1. **Start the API Server:**
   ```bash
   cd packages/api-server
   npm install
   npm start
   ```

2. **Start the Web UI:**
   ```bash
   cd packages/web-ui
   npm install
   npm run dev
   ```
   Open http://localhost:5173

3. **Use the CLI:**
   ```bash
   cd packages/cli
   npm install
   npm run build
   npm link
   swarm status
   ```

## Architecture

All UI interfaces connect to the same API server, providing a consistent experience across platforms:

```
┌─────────────┐
│   Web UI    │
│  (React)    │
└──────┬──────┘
       │
┌──────┴──────┐      ┌──────────────┐      ┌─────────────┐
│             │      │              │      │             │
│   CLI       │──────┤  API Server  ├──────┤  VS Code    │
│             │      │  (Express)   │      │  Extension  │
└─────────────┘      │              │      └─────────────┘
                     │  WebSocket   │
┌─────────────┐      │              │      ┌─────────────┐
│   Cursor    │──────┤              ├──────┤  IntelliJ   │
│  Extension  │      └──────────────┘      │   Plugin    │
└─────────────┘              │             └─────────────┘
                             │
                     ┌───────┴───────┐
                     │               │
                  ┌──┴──┐        ┌──┴──┐
                  │Swarm│        │Core │
                  │     │        │     │
                  └─────┘        └─────┘
```

## API Endpoints

See `packages/api-server/README.md` for complete API documentation.

## Development

Each package can be developed independently. They all use TypeScript (except IntelliJ plugin which uses Kotlin).

## Future Enhancements

- Authentication/authorization
- Advanced filtering and search
- Task templates
- Custom agent configuration UI
- Performance metrics and analytics

