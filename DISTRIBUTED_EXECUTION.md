# Distributed Execution Guide

This guide explains the distributed execution infrastructure in Agent Swarm.

## Overview

The distributed execution system allows agents to execute on remote nodes, enabling horizontal scaling and distributed task processing.

## Architecture

**Components:**
- `NodeManager` - Manages node discovery and health checking
- `NodeRegistry` - Registry of available nodes
- `TaskDispatcher` - Routes tasks to appropriate nodes
- `RemoteAgentProxy` - Proxy for remote agents

## Configuration

Enable distributed execution:

```typescript
import { Swarm } from './src/index.js';

const swarm = new Swarm({
  distributedExecution: {
    enabled: true,
    nodeId: 'node-1',
    discoveryMethod: 'static',
    nodes: [
      { id: 'node-1', url: 'http://localhost:3001' },
      { id: 'node-2', url: 'http://localhost:3002' },
    ],
    transport: 'http', // or 'websocket'
  },
});
```

## Node Discovery

### Static Discovery
Manually specify nodes in configuration:

```typescript
distributedExecution: {
  discoveryMethod: 'static',
  nodes: [
    { id: 'node-1', url: 'http://node1.example.com' },
    { id: 'node-2', url: 'http://node2.example.com' },
  ],
}
```

### Dynamic Discovery
Automatic node discovery (implementation pending):

```typescript
distributedExecution: {
  discoveryMethod: 'dynamic',
  // Nodes discovered automatically
}
```

## Node Health Checking

Nodes are automatically health-checked:

```typescript
const nodeManager = swarm.getNodeManager();
nodeManager.startHealthChecks(30000); // Check every 30 seconds
```

Health check events:
- `node_registered` - New node registered
- `node_offline` - Node went offline
- `node_error` - Node health check failed

## Task Routing

Tasks are automatically routed to suitable nodes based on:
- Agent capabilities
- Node availability
- Load balancing (round-robin by default)

## Network Transport

**Note:** Full network transport implementation is pending. The infrastructure supports:
- HTTP transport (REST API)
- WebSocket transport (real-time)

## Best Practices

1. **Node Configuration**: Ensure all nodes have consistent agent capabilities
2. **Health Monitoring**: Monitor node health and remove unhealthy nodes
3. **Load Balancing**: Implement custom load balancing if needed
4. **Error Handling**: Handle network failures gracefully with retries

## Future Enhancements

- Full HTTP/WebSocket transport implementation
- Advanced load balancing algorithms
- Node auto-scaling
- Cross-node task dependencies

