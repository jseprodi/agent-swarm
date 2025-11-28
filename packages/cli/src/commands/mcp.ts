/**
 * MCP server management commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createAPIClient } from '../api/client.js';

export function mcpCommands(program: Command): void {
  const mcp = program
    .command('mcp')
    .description('MCP server management commands');

  // List MCP servers
  mcp
    .command('list')
    .description('List all MCP servers')
    .action(async () => {
      const api = createAPIClient();
      try {
        const { servers } = await api.listMCPServers();
        console.log(chalk.blue('MCP Servers:'));
        servers.forEach((server: any) => {
          const statusColor = server.status === 'connected' ? chalk.green : chalk.red;
          console.log(`  ${server.name} (${server.id}) - ${statusColor(server.status)}`);
        });
      } catch (error) {
        console.error(chalk.red('Error listing MCP servers:'), error);
        process.exit(1);
      }
    });

  // Connect to server
  mcp
    .command('connect <id>')
    .description('Connect to an MCP server')
    .action(async (id: string) => {
      const api = createAPIClient();
      try {
        await api.connectMCPServer(id);
        console.log(chalk.green(`Connected to MCP server: ${id}`));
      } catch (error) {
        console.error(chalk.red('Error connecting to MCP server:'), error);
        process.exit(1);
      }
    });

  // Discover servers
  mcp
    .command('discover')
    .description('Discover new MCP servers')
    .option('-c, --capabilities <capabilities>', 'Required capabilities (comma-separated)')
    .action(async (options: { capabilities?: string }) => {
      const api = createAPIClient();
      try {
        const capabilities = options.capabilities?.split(',') || [];
        console.log(chalk.blue('Discovering MCP servers...'));
        const result = await api.discoverMCPServers({ capabilities });
        console.log(chalk.green('Discovery completed!'));
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(chalk.red('Error discovering servers:'), error);
        process.exit(1);
      }
    });
}

