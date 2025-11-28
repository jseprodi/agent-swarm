/**
 * VS Code Extension Entry Point
 */

import * as vscode from 'vscode';
import { TaskTreeDataProvider } from './views/TaskTreeDataProvider';
import { AgentTreeDataProvider } from './views/AgentTreeDataProvider';
import { APIClient } from './api/client';

const API_BASE_URL = vscode.workspace.getConfiguration('agentSwarm').get<string>('apiUrl', 'http://localhost:3000');

export function activate(context: vscode.ExtensionContext) {
  console.log('Agent Swarm extension activated');

  const apiClient = new APIClient(API_BASE_URL);

  // Register tree data providers
  const taskTreeProvider = new TaskTreeDataProvider(apiClient);
  const agentTreeProvider = new AgentTreeDataProvider(apiClient);

  vscode.window.registerTreeDataProvider('agentSwarmTasks', taskTreeProvider);
  vscode.window.registerTreeDataProvider('agentSwarmAgents', agentTreeProvider);

  // Register commands
  const createTaskCommand = vscode.commands.registerCommand('agentSwarm.createTask', async () => {
    const description = await vscode.window.showInputBox({
      prompt: 'Enter task description',
      placeHolder: 'e.g., Generate a TypeScript function...',
    });

    if (description) {
      try {
        await apiClient.createTask(description);
        vscode.window.showInformationMessage('Task created successfully');
        taskTreeProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
      }
    }
  });

  const showTasksCommand = vscode.commands.registerCommand('agentSwarm.showTasks', () => {
    vscode.commands.executeCommand('agentSwarmTasks.focus');
  });

  const showAgentsCommand = vscode.commands.registerCommand('agentSwarm.showAgents', () => {
    vscode.commands.executeCommand('agentSwarmAgents.focus');
  });

  context.subscriptions.push(createTaskCommand, showTasksCommand, showAgentsCommand);

  // Refresh tree views periodically
  setInterval(() => {
    taskTreeProvider.refresh();
    agentTreeProvider.refresh();
  }, 5000);
}

export function deactivate() {}

