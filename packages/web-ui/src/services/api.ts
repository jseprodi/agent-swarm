/**
 * API Client Service
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Task API
export const taskAPI = {
  create: (description: string, metadata?: Record<string, unknown>) =>
    api.post('/api/tasks', { description, metadata }),
  list: (filters?: { status?: string; agent?: string }) =>
    api.get('/api/tasks', { params: filters }),
  get: (id: string) => api.get(`/api/tasks/${id}`),
  cancel: (id: string) => api.post(`/api/tasks/${id}/cancel`),
};

// Agent API
export const agentAPI = {
  list: () => api.get('/api/agents'),
  get: (id: string) => api.get(`/api/agents/${id}`),
  getStatus: (id: string) => api.get(`/api/agents/${id}/status`),
};

// MCP API
export const mcpAPI = {
  listServers: () => api.get('/api/mcp/servers'),
  getServer: (id: string) => api.get(`/api/mcp/servers/${id}`),
  connect: (serverId: string) => api.post('/api/mcp/servers/connect', { serverId }),
  disconnect: (id: string) => api.post(`/api/mcp/servers/${id}/disconnect`),
  discover: (options: { capabilities?: string[] }) =>
    api.post('/api/mcp/servers/discover', options),
};

// Config API
export const configAPI = {
  get: () => api.get('/api/config'),
  getLLMProviders: () => api.get('/api/config/llm/providers'),
};

// Stats API
export const statsAPI = {
  get: () => api.get('/api/stats'),
};

