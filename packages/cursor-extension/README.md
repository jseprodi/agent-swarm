# Agent Swarm Cursor Extension

Cursor extension for Agent Swarm system.

## Features

- View tasks in sidebar
- View agents in sidebar  
- Create tasks from command palette
- Real-time updates
- Native Cursor IDE integration

## Usage

1. Install the extension in Cursor
2. Configure API URL in settings (default: http://localhost:3000)
3. Use command palette to create tasks or view status

## Configuration

The extension uses Cursor's settings API. Configure the API URL:
- Open Cursor Settings
- Search for "Agent Swarm"
- Set `agentSwarm.apiUrl` to your API server URL

## Commands

- `Agent Swarm: Create Task` - Create a new task
- `Agent Swarm: Show Tasks` - Focus on tasks view
- `Agent Swarm: Show Agents` - Focus on agents view

## Development

```bash
cd packages/cursor-extension
npm install
npm run compile
```

## Building

```bash
npm run compile
```

The compiled extension will be in the `out/` directory.

## Notes

This extension is similar to the VS Code extension but adapted for Cursor's environment. Cursor is based on VS Code, so the extension API is compatible, but some Cursor-specific features may be available.

