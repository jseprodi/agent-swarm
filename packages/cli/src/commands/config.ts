/**
 * Configuration commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createAPIClient } from '../api/client.js';

export function configCommands(program: Command): void {
  const config = program
    .command('config')
    .description('Configuration commands');

  config
    .command('show')
    .description('Show current configuration')
    .action(async () => {
      const api = createAPIClient();
      try {
        const config = await api.getConfig();
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        console.error(chalk.red('Error getting configuration:'), error);
        process.exit(1);
      }
    });
}

