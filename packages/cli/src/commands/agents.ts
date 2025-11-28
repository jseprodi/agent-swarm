/**
 * Agent management commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createAPIClient } from '../api/client.js';
import { formatAgentList } from '../output/agents.js';

export function agentCommands(program: Command): void {
  const agents = program
    .command('agent')
    .description('Agent management commands')
    .alias('a');

  // List agents
  agents
    .command('list')
    .description('List all agents')
    .action(async () => {
      const api = createAPIClient();
      try {
        const { agents } = await api.listAgents();
        console.log(formatAgentList(agents));
      } catch (error) {
        console.error(chalk.red('Error listing agents:'), error);
        process.exit(1);
      }
    });

  // Show agent status
  agents
    .command('status <id>')
    .description('Show agent status')
    .action(async (id: string) => {
      const api = createAPIClient();
      try {
        const status = await api.getAgentStatus(id);
        console.log(chalk.blue(`Agent: ${id}`));
        console.log(`Status: ${status.isAvailable ? chalk.green('Available') : chalk.yellow('Busy')}`);
        console.log(`Capabilities: ${status.capabilities.join(', ')}`);
        console.log(`Active Tasks: ${status.activeTasks}`);
        console.log(`Total Tasks: ${status.totalTasks}`);
      } catch (error) {
        console.error(chalk.red('Error getting agent status:'), error);
        process.exit(1);
      }
    });
}

