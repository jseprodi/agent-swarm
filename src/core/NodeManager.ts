/**
 * Node Manager - Manages distributed nodes
 */

import { EventEmitter } from 'events';
import { NodeRegistry, type AgentNode } from './DistributedExecutor.js';
import logger from '../utils/logger.js';

/**
 * Node Manager
 */
export class NodeManager extends EventEmitter {
  private registry: NodeRegistry;
  private healthCheckInterval?: NodeJS.Timeout;
  private healthCheckIntervalMs: number = 30000; // 30 seconds

  constructor() {
    super();
    this.registry = new NodeRegistry();
  }

  /**
   * Register a node
   */
  registerNode(node: AgentNode): void {
    this.registry.registerNode(node);
    this.emit('node_registered', node);
  }

  /**
   * Discover nodes (static or dynamic)
   */
  async discoverNodes(method: 'static' | 'dynamic', nodes?: Array<{ id: string; url: string }>): Promise<void> {
    if (method === 'static' && nodes) {
      for (const nodeConfig of nodes) {
        const node: AgentNode = {
          id: nodeConfig.id,
          url: nodeConfig.url,
          status: 'online',
          lastSeen: Date.now(),
          agents: [], // Would be populated by querying the node
        };
        this.registerNode(node);
      }
    } else if (method === 'dynamic') {
      // Dynamic discovery would use service discovery mechanisms
      logger.warn('Dynamic node discovery not fully implemented');
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks(intervalMs?: number): void {
    if (this.healthCheckInterval) {
      logger.warn('Health checks already running');
      return;
    }

    this.healthCheckIntervalMs = intervalMs || 30000;
    this.performHealthChecks();

    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckIntervalMs);

    logger.info('Node health checks started');
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      logger.info('Node health checks stopped');
    }
  }

  /**
   * Perform health checks on all nodes
   */
  private async performHealthChecks(): Promise<void> {
    const nodes = this.registry.getAllNodes();

    for (const node of nodes) {
      try {
        // In production, would make HTTP request to node health endpoint
        // For now, just check if node was seen recently
        const timeSinceLastSeen = Date.now() - node.lastSeen;
        if (timeSinceLastSeen > 60000) { // 1 minute
          this.registry.updateNodeStatus(node.id, 'offline');
          this.emit('node_offline', node);
        } else {
          this.registry.updateNodeStatus(node.id, 'online');
        }
      } catch (error) {
        logger.error(`Health check failed for node ${node.id}:`, error);
        this.registry.updateNodeStatus(node.id, 'error');
        this.emit('node_error', node, error);
      }
    }
  }

  /**
   * Get registry
   */
  getRegistry(): NodeRegistry {
    return this.registry;
  }
}

