# Agent Swarm API Server

REST/WebSocket API server for the Agent Swarm system.

## Usage

```bash
npm install
npm run build
npm start
```

The server will start on port 3000 (or PORT from .env).

## API Endpoints

### Tasks
- `POST /api/tasks` - Create new task
- `GET /api/tasks` - List all tasks
- `GET /api/tasks/:id` - Get task details
- `GET /api/tasks/:id/result` - Get task result
- `POST /api/tasks/:id/cancel` - Cancel task

### Agents
- `GET /api/agents` - List all agents
- `GET /api/agents/:id` - Get agent details
- `GET /api/agents/:id/status` - Get agent status
- `GET /api/agents/:id/tasks` - Get agent's tasks

### MCP Servers
- `GET /api/mcp/servers` - List MCP servers
- `GET /api/mcp/servers/:id` - Get server details
- `POST /api/mcp/servers/connect` - Connect to server
- `POST /api/mcp/servers/:id/disconnect` - Disconnect server
- `POST /api/mcp/servers/discover` - Trigger discovery
- `GET /api/mcp/servers/:id/capabilities` - Get server capabilities

### Configuration & Stats
- `GET /api/config` - Get configuration
- `GET /api/config/llm/providers` - List LLM providers
- `GET /api/stats` - Get system statistics
- `GET /health` - Health check

## WebSocket

Connect to `ws://localhost:3000` for real-time updates.

### Subscribe to events
```json
{
  "type": "subscribe",
  "events": ["task_completed", "task_failed", "agent_ready"]
}
```

### Events
- `task_completed` - Task completed
- `task_failed` - Task failed
- `agent_ready` - Agent available
- `mcp_server_connected` - MCP server connected

