/**
 * Task management commands
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createAPIClient } from '../api/client.js';
import { formatTask, formatTaskList } from '../output/tasks.js';

export function taskCommands(program: Command): void {
  const tasks = program
    .command('task')
    .description('Task management commands')
    .alias('t');

  // Create task
  tasks
    .command('create <description>')
    .description('Create and execute a new task')
    .option('-m, --metadata <json>', 'Task metadata as JSON')
    .action(async (description: string, options: { metadata?: string }) => {
      const api = createAPIClient();
      let metadata: Record<string, unknown> | undefined;

      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata);
        } catch (error) {
          console.error(chalk.red('Error: Invalid JSON metadata'));
          process.exit(1);
        }
      }

      console.log(chalk.blue('Creating task...'));
      try {
        const result = await api.createTask(description, metadata);
        console.log(chalk.green('\nTask created and executed!'));
        console.log(formatTask(result));
      } catch (error) {
        console.error(chalk.red('Error creating task:'), error);
        process.exit(1);
      }
    });

  // List tasks
  tasks
    .command('list')
    .description('List all tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('-a, --agent <agentId>', 'Filter by agent')
    .action(async (options: { status?: string; agent?: string }) => {
      const api = createAPIClient();
      try {
        const { tasks } = await api.listTasks(options);
        console.log(formatTaskList(tasks));
      } catch (error) {
        console.error(chalk.red('Error listing tasks:'), error);
        process.exit(1);
      }
    });

  // Show task
  tasks
    .command('show <id>')
    .description('Show task details')
    .action(async (id: string) => {
      const api = createAPIClient();
      try {
        const data = await api.getTask(id);
        console.log(formatTask(data.task));
        if (data.subtasks && data.subtasks.length > 0) {
          console.log(chalk.blue('\nSubtasks:'));
          data.subtasks.forEach((subtask: any) => {
            console.log(`  - ${subtask.description} (${subtask.status})`);
          });
        }
        if (data.result) {
          console.log(chalk.blue('\nResult:'));
          console.log(JSON.stringify(data.result, null, 2));
        }
      } catch (error) {
        console.error(chalk.red('Error getting task:'), error);
        process.exit(1);
      }
    });

  // Task logs (placeholder - would need log storage)
  tasks
    .command('logs <id>')
    .description('Show task execution logs')
    .action(async (id: string) => {
      console.log(chalk.yellow('Log viewing not yet implemented'));
      // Would implement log retrieval here
    });

  // Cancel task
  tasks
    .command('cancel <id>')
    .description('Cancel a task')
    .action(async (id: string) => {
      const api = createAPIClient();
      try {
        await api.cancelTask(id);
        console.log(chalk.green(`Task ${id} cancelled`));
      } catch (error) {
        console.error(chalk.red('Error cancelling task:'), error);
        process.exit(1);
      }
    });
}

