/**
 * Task output formatting
 */

import chalk from 'chalk';

export function formatTask(task: any): string {
  const statusColor = getStatusColor(task.status);
  return `
${chalk.bold('Task Details')}
  ID: ${task.taskId || task.id}
  Description: ${task.description || 'N/A'}
  Status: ${statusColor(task.status)}
  Created: ${new Date(task.createdAt || Date.now()).toLocaleString()}
  ${task.success !== undefined ? `Success: ${task.success ? chalk.green('Yes') : chalk.red('No')}` : ''}
`;
}

export function formatTaskList(tasks: any[]): string {
  if (tasks.length === 0) {
    return chalk.yellow('No tasks found');
  }

  const lines = [chalk.bold('Tasks:\n')];
  tasks.forEach((task) => {
    const statusColor = getStatusColor(task.status);
    lines.push(
      `  ${task.id.substring(0, 8)} - ${task.description.substring(0, 50)}... - ${statusColor(task.status)}`
    );
  });

  return lines.join('\n');
}

function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'completed':
      return chalk.green;
    case 'failed':
      return chalk.red;
    case 'in_progress':
      return chalk.blue;
    case 'pending':
      return chalk.yellow;
    default:
      return chalk.gray;
  }
}

