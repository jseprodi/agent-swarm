/**
 * System status command
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createAPIClient } from '../api/client.js';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show system status')
    .action(async () => {
      const api = createAPIClient();
      try {
        const stats = await api.getStats();
        console.log(chalk.blue('Agent Swarm System Status\n'));
        console.log(`Tasks: ${stats.tasks.total} total, ${stats.tasks.completed} completed, ${stats.tasks.failed} failed`);
        console.log(`Agents: ${stats.agents.total} total, ${stats.agents.available} available`);
        console.log(`MCP Servers: ${stats.mcpServers.total} total, ${stats.mcpServers.connected} connected`);
      } catch (error) {
        console.error(chalk.red('Error getting status:'), error);
        process.exit(1);
      }
    });
}

