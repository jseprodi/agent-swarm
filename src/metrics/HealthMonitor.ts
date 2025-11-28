/**
 * Health Monitor - System health monitoring
 */

import { EventEmitter } from 'events';
import type { AgentRegistry } from '../communication/AgentRegistry.js';
import type { MCPManager } from '../mcp/MCPManager.js';
import type { TaskManager } from '../core/TaskManager.js';
import type { MetricsCollector } from './MetricsCollector.js';
import logger from '../utils/logger.js';

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
  lastChecked: number;
}

/**
 * System health report
 */
export interface HealthReport {
  status: HealthStatus;
  timestamp: number;
  components: ComponentHealth[];
  summary: {
    agents: { total: number; available: number; busy: number };
    mcpServers: { total: number; connected: number; error: number };
    tasks: { total: number; completed: number; failed: number; inProgress: number };
  };
}

/**
 * Health Monitor
 */
export class HealthMonitor extends EventEmitter {
  private agentRegistry?: AgentRegistry;
  private mcpManager?: MCPManager;
  private taskManager?: TaskManager;
  private metricsCollector?: MetricsCollector;
  private checkInterval?: NodeJS.Timeout;
  private checkIntervalMs: number = 30000; // 30 seconds
  private lastHealthReport?: HealthReport;

  constructor(
    agentRegistry?: AgentRegistry,
    mcpManager?: MCPManager,
    taskManager?: TaskManager,
    metricsCollector?: MetricsCollector,
    checkIntervalMs?: number
  ) {
    super();
    this.agentRegistry = agentRegistry;
    this.mcpManager = mcpManager;
    this.taskManager = taskManager;
    this.metricsCollector = metricsCollector;
    this.checkIntervalMs = checkIntervalMs || 30000;
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.checkInterval) {
      logger.warn('Health monitor already started');
      return;
    }

    logger.info('Starting health monitor');
    this.performHealthCheck();

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
      logger.info('Health monitor stopped');
    }
  }

  /**
   * Perform health check
   */
  performHealthCheck(): HealthReport {
    const components: ComponentHealth[] = [];
    let overallStatus: HealthStatus = 'healthy';

    // Check agents
    if (this.agentRegistry) {
      const agents = this.agentRegistry.getAllAgents();
      const available = this.agentRegistry.getAvailableAgents();
      const busy = agents.length - available.length;

      const agentHealth: ComponentHealth = {
        name: 'agents',
        status: agents.length > 0 ? 'healthy' : 'degraded',
        lastChecked: Date.now(),
        details: {
          total: agents.length,
          available: available.length,
          busy,
        },
      };

      if (available.length === 0 && agents.length > 0) {
        agentHealth.status = 'unhealthy';
        agentHealth.message = 'No agents available';
        overallStatus = 'unhealthy';
      } else if (available.length < agents.length * 0.5) {
        agentHealth.status = 'degraded';
        agentHealth.message = 'Less than 50% of agents available';
        if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }

      components.push(agentHealth);
    }

    // Check MCP servers
    if (this.mcpManager) {
      const registry = this.mcpManager.getRegistry();
      const allServers = registry.getAllServers();
      const connected = registry.getConnectedServers();
      const errorServers = allServers.filter(s => s.status === 'error');

      const mcpHealth: ComponentHealth = {
        name: 'mcp_servers',
        status: connected.length > 0 ? 'healthy' : 'degraded',
        lastChecked: Date.now(),
        details: {
          total: allServers.length,
          connected: connected.length,
          error: errorServers.length,
        },
      };

      if (errorServers.length > allServers.length * 0.5) {
        mcpHealth.status = 'unhealthy';
        mcpHealth.message = 'More than 50% of MCP servers in error state';
        overallStatus = 'unhealthy';
      } else if (connected.length < allServers.length * 0.8) {
        mcpHealth.status = 'degraded';
        mcpHealth.message = 'Less than 80% of MCP servers connected';
        if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }

      components.push(mcpHealth);
    }

    // Check tasks
    if (this.taskManager) {
      const stats = this.taskManager.getStatistics();
      const failureRate = stats.total > 0 ? stats.failed / stats.total : 0;

      const taskHealth: ComponentHealth = {
        name: 'tasks',
        status: failureRate < 0.1 ? 'healthy' : failureRate < 0.3 ? 'degraded' : 'unhealthy',
        lastChecked: Date.now(),
        details: {
          total: stats.total,
          completed: stats.completed,
          failed: stats.failed,
          inProgress: stats.inProgress,
          failureRate,
        },
      };

      if (failureRate >= 0.3) {
        taskHealth.message = `High failure rate: ${(failureRate * 100).toFixed(1)}%`;
        overallStatus = 'unhealthy';
      } else if (failureRate >= 0.1) {
        taskHealth.message = `Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`;
        if (overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      }

      components.push(taskHealth);
    }

    // Check system resources (if available)
    const memoryUsage = process.memoryUsage();
    const memoryHealth: ComponentHealth = {
      name: 'memory',
      status: memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'healthy' : 'degraded',
      lastChecked: Date.now(),
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        usagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
    };

    if (memoryUsage.heapUsed / memoryUsage.heapTotal >= 0.95) {
      memoryHealth.status = 'unhealthy';
      memoryHealth.message = 'Memory usage above 95%';
      overallStatus = 'unhealthy';
    }

    components.push(memoryHealth);

    // Build summary
    const summary = {
      agents: {
        total: this.agentRegistry?.getAllAgents().length || 0,
        available: this.agentRegistry?.getAvailableAgents().length || 0,
        busy: (this.agentRegistry?.getAllAgents().length || 0) - (this.agentRegistry?.getAvailableAgents().length || 0),
      },
      mcpServers: {
        total: this.mcpManager?.getRegistry().getAllServers().length || 0,
        connected: this.mcpManager?.getRegistry().getConnectedServers().length || 0,
        error: this.mcpManager?.getRegistry().getAllServers().filter(s => s.status === 'error').length || 0,
      },
      tasks: {
        total: this.taskManager?.getStatistics().total || 0,
        completed: this.taskManager?.getStatistics().completed || 0,
        failed: this.taskManager?.getStatistics().failed || 0,
        inProgress: this.taskManager?.getStatistics().inProgress || 0,
      },
    };

    const report: HealthReport = {
      status: overallStatus,
      timestamp: Date.now(),
      components,
      summary,
    };

    this.lastHealthReport = report;
    this.emit('health_check', report);

    // Emit status-specific events
    if (overallStatus === 'unhealthy') {
      this.emit('unhealthy', report);
    } else if (overallStatus === 'degraded') {
      this.emit('degraded', report);
    }

    return report;
  }

  /**
   * Get last health report
   */
  getLastHealthReport(): HealthReport | undefined {
    return this.lastHealthReport;
  }

  /**
   * Get current health status
   */
  getStatus(): HealthStatus {
    return this.lastHealthReport?.status || 'healthy';
  }
}

