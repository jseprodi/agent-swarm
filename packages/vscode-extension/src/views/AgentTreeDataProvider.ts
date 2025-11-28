/**
 * Agent Tree Data Provider
 */

import * as vscode from 'vscode';
import { APIClient } from '../api/client';

export class AgentTreeDataProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgentItem | undefined | null | void> = new vscode.EventEmitter<AgentItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private apiClient: APIClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentItem): Promise<AgentItem[]> {
    if (!element) {
      try {
        const agents = await this.apiClient.listAgents();
        return agents.map((agent: any) => new AgentItem(
          agent.name,
          agent.description,
          agent.id,
          vscode.TreeItemCollapsibleState.None
        ));
      } catch (error) {
        return [new AgentItem('Error loading agents', '', '', vscode.TreeItemCollapsibleState.None)];
      }
    }
    return [];
  }
}

class AgentItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly agentId: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = this.description;
    this.contextValue = 'agent';
  }
}

