/**
 * Agent output formatting
 */

import chalk from 'chalk';

export function formatAgentList(agents: any[]): string {
  if (agents.length === 0) {
    return chalk.yellow('No agents found');
  }

  const lines = [chalk.bold('Agents:\n')];
  agents.forEach((agent) => {
    lines.push(`  ${chalk.bold(agent.name)} (${agent.id})`);
    lines.push(`    ${agent.description}`);
    lines.push(`    Capabilities: ${agent.capabilities.join(', ')}\n`);
  });

  return lines.join('\n');
}

