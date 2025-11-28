/**
 * API Client for CLI
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export function createAPIClient(): APIClient {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return new APIClient(client);
}

class APIClient {
  constructor(private axios: AxiosInstance) {}

  // Task methods
  async createTask(description: string, metadata?: Record<string, unknown>) {
    const { data } = await this.axios.post('/api/tasks', { description, metadata });
    return data;
  }

  async listTasks(filters?: { status?: string; agent?: string }) {
    const { data } = await this.axios.get('/api/tasks', { params: filters });
    return data;
  }

  async getTask(id: string) {
    const { data } = await this.axios.get(`/api/tasks/${id}`);
    return data;
  }

  async cancelTask(id: string) {
    const { data } = await this.axios.post(`/api/tasks/${id}/cancel`);
    return data;
  }

  // Agent methods
  async listAgents() {
    const { data } = await this.axios.get('/api/agents');
    return data;
  }

  async getAgentStatus(id: string) {
    const { data } = await this.axios.get(`/api/agents/${id}/status`);
    return data;
  }

  // MCP methods
  async listMCPServers() {
    const { data } = await this.axios.get('/api/mcp/servers');
    return data;
  }

  async connectMCPServer(id: string) {
    const { data } = await this.axios.post('/api/mcp/servers/connect', { serverId: id });
    return data;
  }

  async discoverMCPServers(options: { capabilities?: string[] }) {
    const { data } = await this.axios.post('/api/mcp/servers/discover', options);
    return data;
  }

  // Config methods
  async getConfig() {
    const { data } = await this.axios.get('/api/config');
    return data;
  }

  // Stats methods
  async getStats() {
    const { data } = await this.axios.get('/api/stats');
    return data;
  }
}

