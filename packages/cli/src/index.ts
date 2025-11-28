#!/usr/bin/env node

/**
 * Agent Swarm CLI
 */

import { Command } from 'commander';
import { taskCommands } from './commands/tasks.js';
import { agentCommands } from './commands/agents.js';
import { mcpCommands } from './commands/mcp.js';
import { configCommands } from './commands/config.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('swarm')
  .description('Agent Swarm CLI - Manage agents, tasks, and MCP servers')
  .version('0.1.0');

// Add command groups
taskCommands(program);
agentCommands(program);
mcpCommands(program);
configCommands(program);
statusCommand(program);

program.parse();

