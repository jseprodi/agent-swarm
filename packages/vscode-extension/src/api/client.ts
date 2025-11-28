/**
 * API Client for VS Code Extension
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export class APIClient {
  private axios;

  constructor(baseURL: string = API_BASE_URL) {
    this.axios = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async createTask(description: string, metadata?: Record<string, unknown>) {
    const { data } = await this.axios.post('/api/tasks', { description, metadata });
    return data;
  }

  async listTasks() {
    const { data } = await this.axios.get('/api/tasks');
    return data.tasks || [];
  }

  async getTask(id: string) {
    const { data } = await this.axios.get(`/api/tasks/${id}`);
    return data;
  }

  async listAgents() {
    const { data } = await this.axios.get('/api/agents');
    return data.agents || [];
  }
}

