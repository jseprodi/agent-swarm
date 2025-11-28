# Agent Swarm API Server

REST/WebSocket API server for the Agent Swarm system.

## Usage

```bash
npm install
npm run build
npm start
```

The server will start on port 3000 (or PORT from .env).

## Authentication

If `API_KEY` environment variable is set, all API requests must include the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/tasks
```

If `API_KEY` is not set, authentication is disabled (development mode).

## Rate Limiting

The API implements rate limiting to prevent abuse:
- Default: 100 requests per 60 seconds per IP address
- Configure via environment variables:
  - `RATE_LIMIT_WINDOW_MS` - Time window in milliseconds (default: 60000)
  - `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - When the rate limit resets

## API Endpoints

### Tasks

#### Create Task
**POST** `/api/tasks`

Create a new task for the swarm to execute.

**Request Body:**
```json
{
  "description": "Generate a TypeScript function that calculates factorial",
  "metadata": {
    "priority": "high",
    "tags": ["code-generation"]
  }
}
```

**Response:** `201 Created`
```json
{
  "taskId": "uuid",
  "success": true,
  "data": { ... }
}
```

**Validation:**
- `description` (required): String, 1-10000 characters
- `metadata` (optional): Object with arbitrary key-value pairs

#### List Tasks
**GET** `/api/tasks`

List all tasks with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `failed`, `cancelled`)
- `agentId` (optional): Filter by assigned agent ID

**Response:** `200 OK`
```json
{
  "tasks": [...],
  "count": 10
}
```

#### Get Task Details
**GET** `/api/tasks/:id`

Get detailed information about a specific task.

**Response:** `200 OK`
```json
{
  "task": { ... },
  "subtasks": [...],
  "result": { ... }
}
```

**Errors:**
- `404 Not Found` - Task not found

#### Get Task Result
**GET** `/api/tasks/:id/result`

Get the result of a completed task.

**Response:** `200 OK`
```json
{
  "taskId": "uuid",
  "success": true,
  "data": { ... }
}
```

**Errors:**
- `404 Not Found` - Task result not found

#### Cancel Task
**POST** `/api/tasks/:id/cancel`

Cancel a pending or in-progress task.

**Response:** `200 OK`
```json
{
  "message": "Task cancelled",
  "taskId": "uuid"
}
```

**Errors:**
- `404 Not Found` - Task not found
- `400 Bad Request` - Task is already completed/failed/cancelled

### Agents

#### List Agents
**GET** `/api/agents`

List all registered agents.

**Response:** `200 OK`
```json
{
  "agents": [...],
  "count": 7
}
```

#### Get Agent Details
**GET** `/api/agents/:id`

Get detailed information about a specific agent.

**Response:** `200 OK`
```json
{
  "id": "code-agent",
  "name": "Code Agent",
  "description": "...",
  "capabilities": [...],
  "isAvailable": true
}
```

**Errors:**
- `404 Not Found` - Agent not found

#### Get Agent Status
**GET** `/api/agents/:id/status`

Get current status and statistics for an agent.

**Response:** `200 OK`
```json
{
  "agentId": "code-agent",
  "isAvailable": true,
  "capabilities": [...],
  "mcpServersUsed": [...],
  "activeTasks": 2,
  "totalTasks": 15
}
```

**Errors:**
- `404 Not Found` - Agent not found

#### Get Agent Tasks
**GET** `/api/agents/:id/tasks`

Get all tasks assigned to a specific agent.

**Response:** `200 OK`
```json
{
  "tasks": [...],
  "count": 5
}
```

### MCP Servers

#### List MCP Servers
**GET** `/api/mcp/servers`

List all registered MCP servers.

**Response:** `200 OK`
```json
{
  "servers": [...],
  "count": 3
}
```

#### Get Server Details
**GET** `/api/mcp/servers/:id`

Get detailed information about a specific MCP server.

**Response:** `200 OK`
```json
{
  "id": "server-id",
  "name": "File System Server",
  "status": "connected",
  "capabilities": { ... }
}
```

**Errors:**
- `404 Not Found` - Server not found

#### Connect to Server
**POST** `/api/mcp/servers/connect`

Connect to an MCP server.

**Request Body:**
```json
{
  "serverId": "server-id"
}
```

**Response:** `200 OK`
```json
{
  "message": "Connected to MCP server",
  "serverId": "server-id",
  "capabilities": { ... }
}
```

**Errors:**
- `400 Bad Request` - Missing or invalid serverId
- `500 Internal Server Error` - Connection failed

#### Disconnect Server
**POST** `/api/mcp/servers/:id/disconnect`

Disconnect from an MCP server.

**Response:** `200 OK`
```json
{
  "message": "Disconnected from MCP server",
  "serverId": "server-id"
}
```

#### Trigger Discovery
**POST** `/api/mcp/servers/discover`

Trigger discovery of MCP servers based on capabilities or keywords.

**Request Body:**
```json
{
  "capabilities": ["file_operations", "git"],
  "keywords": ["filesystem", "version-control"]
}
```

**Response:** `200 OK`
```json
{
  "message": "Discovery triggered",
  "taskId": "uuid",
  "result": { ... }
}
```

#### Get Server Capabilities
**GET** `/api/mcp/servers/:id/capabilities`

Get capabilities of a connected MCP server.

**Response:** `200 OK`
```json
{
  "serverId": "server-id",
  "capabilities": {
    "tools": [...],
    "resources": [...],
    "prompts": [...]
  }
}
```

**Errors:**
- `404 Not Found` - Server not connected

### Configuration & Stats

#### Get Configuration
**GET** `/api/config`

Get current system configuration.

**Response:** `200 OK`
```json
{
  "llmProvider": {
    "name": "Cursor",
    "available": true
  }
}
```

#### List LLM Providers
**GET** `/api/config/llm/providers`

Get list of available LLM providers.

**Response:** `200 OK`
```json
{
  "providers": [
    { "id": "cursor", "name": "Cursor", "description": "Cursor runtime LLM" },
    { "id": "openai", "name": "OpenAI", "description": "OpenAI GPT models" },
    { "id": "anthropic", "name": "Anthropic", "description": "Anthropic Claude models" }
  ]
}
```

#### Get Statistics
**GET** `/api/stats`

Get system-wide statistics.

**Response:** `200 OK`
```json
{
  "tasks": {
    "total": 50,
    "byStatus": { ... },
    "completed": 45,
    "failed": 2,
    "inProgress": 2,
    "pending": 1
  },
  "agents": {
    "total": 7,
    "available": 5
  },
  "mcpServers": {
    "total": 3,
    "connected": 2
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Health Check
**GET** `/health`

Health check endpoint (no authentication required).

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket

Connect to `ws://localhost:3000` for real-time updates.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000');
```

### Subscribe to Events

Send a subscription message:

```json
{
  "type": "subscribe",
  "events": ["task_completed", "task_failed", "agent_ready", "mcp_server_connected"]
}
```

### Events

- `task_completed` - Task completed successfully
- `task_failed` - Task failed
- `agent_ready` - Agent became available
- `mcp_server_connected` - MCP server connected

### Event Format

```json
{
  "type": "task_completed",
  "payload": {
    "taskId": "uuid",
    "success": true,
    "data": { ... }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": { ... }  // Optional, for validation errors
}
```

**Status Codes:**
- `400 Bad Request` - Invalid request (validation errors)
- `401 Unauthorized` - Missing or invalid API key
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

## Environment Variables

See `.env.example` for all available environment variables.

