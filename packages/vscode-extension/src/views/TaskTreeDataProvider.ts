/**
 * Task Tree Data Provider
 */

import * as vscode from 'vscode';
import { APIClient } from '../api/client';

export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private apiClient: APIClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TaskItem): Promise<TaskItem[]> {
    if (!element) {
      // Root level - show all tasks
      try {
        const tasks = await this.apiClient.listTasks();
        return tasks.map((task: any) => new TaskItem(
          task.description,
          task.status,
          task.id,
          vscode.TreeItemCollapsibleState.None
        ));
      } catch (error) {
        return [new TaskItem('Error loading tasks', 'error', '', vscode.TreeItemCollapsibleState.None)];
      }
    }
    return [];
  }
}

class TaskItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly status: string,
    public readonly taskId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label} (${this.status})`;
    this.description = this.status;
    this.contextValue = 'task';
  }
}

