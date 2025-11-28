/**
 * Cursor Extension Entry Point
 * Similar to VS Code extension but adapted for Cursor
 */

import * as vscode from 'vscode';
import { TaskTreeDataProvider } from './views/TaskTreeDataProvider';
import { APIClient } from './api/client';

const API_BASE_URL = vscode.workspace.getConfiguration('agentSwarm').get<string>('apiUrl', 'http://localhost:3000');

export function activate(context: vscode.ExtensionContext) {
  console.log('Agent Swarm Cursor extension activated');

  const apiClient = new APIClient(API_BASE_URL);
  const taskTreeProvider = new TaskTreeDataProvider(apiClient);

  vscode.window.registerTreeDataProvider('agentSwarmTasks', taskTreeProvider);

  const createTaskCommand = vscode.commands.registerCommand('agentSwarm.createTask', async () => {
    const description = await vscode.window.showInputBox({
      prompt: 'Enter task description',
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

  context.subscriptions.push(createTaskCommand);
}

export function deactivate() {}

