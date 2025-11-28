/**
 * Message queue for orchestrator coordination
 */

import { EventEmitter } from 'events';
import type { Message, MessageType } from './types.js';
import logger from '../utils/logger.js';

export class MessageQueue extends EventEmitter {
  private messages: Message[] = [];
  private maxHistory: number = 1000;
  private agentHandlers: Map<string, Map<string, (message: Message) => void>> = new Map();
  private pendingRequests: Map<string, { resolve: (message: Message) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners
  }

  /**
   * Publish a message to the queue
   */
  publish(message: Message): void {
    this.messages.push(message);
    
    // Trim history if needed
    if (this.messages.length > this.maxHistory) {
      this.messages.shift();
    }

    logger.debug(`Message published: ${message.type} from ${message.sourceAgentId || 'unknown'}`);

    // Emit the message type as an event
    this.emit(message.type, message);
    
    // Also emit a generic 'message' event
    this.emit('message', message);
  }

  /**
   * Subscribe to messages of a specific type
   */
  subscribe(messageType: MessageType, handler: (message: Message) => void): void {
    this.on(messageType, handler);
    logger.debug(`Subscribed to message type: ${messageType}`);
  }

  /**
   * Subscribe to all messages
   */
  subscribeToAll(handler: (message: Message) => void): void {
    this.on('message', handler);
    logger.debug('Subscribed to all messages');
  }

  /**
   * Unsubscribe from messages
   */
  unsubscribe(messageType: MessageType, handler: (message: Message) => void): void {
    this.off(messageType, handler);
    logger.debug(`Unsubscribed from message type: ${messageType}`);
  }

  /**
   * Get message history
   */
  getHistory(filter?: (message: Message) => boolean): Message[] {
    if (filter) {
      return this.messages.filter(filter);
    }
    return [...this.messages];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(messageType: MessageType): Message[] {
    return this.messages.filter(msg => msg.type === messageType);
  }

  /**
   * Get messages for a specific agent
   */
  getMessagesForAgent(agentId: string): Message[] {
    return this.messages.filter(
      msg => msg.targetAgentId === agentId || msg.sourceAgentId === agentId
    );
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messages = [];
    logger.info('Message queue history cleared');
  }

  /**
   * Wait for a specific message type (with timeout)
   */
  async waitForMessage(
    messageType: MessageType,
    timeout: number = 30000,
    filter?: (message: Message) => boolean
  ): Promise<Message | null> {
    return new Promise((resolve) => {
      const handler = (message: Message) => {
        if (!filter || filter(message)) {
          this.unsubscribe(messageType, handler);
          clearTimeout(timeoutId);
          resolve(message);
        }
      };

      this.subscribe(messageType, handler);

      const timeoutId = setTimeout(() => {
        this.unsubscribe(messageType, handler);
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Send direct message to a specific agent
   */
  sendDirectMessage(targetAgentId: string, message: Message): void {
    message.targetAgentId = targetAgentId;
    this.publish(message);

    // Emit to agent-specific handler if registered
    const handlers = this.agentHandlers.get(targetAgentId);
    if (handlers) {
      const handler = handlers.get(message.type);
      if (handler) {
        try {
          handler(message);
        } catch (error) {
          logger.error(`Error in agent handler for ${targetAgentId}:`, error);
        }
      }
    }
  }

  /**
   * Register agent-specific message handler
   */
  registerAgentHandler(agentId: string, messageType: MessageType, handler: (message: Message) => void): void {
    if (!this.agentHandlers.has(agentId)) {
      this.agentHandlers.set(agentId, new Map());
    }
    const handlers = this.agentHandlers.get(agentId)!;
    handlers.set(messageType, handler);
    logger.debug(`Registered handler for agent ${agentId}, message type ${messageType}`);
  }

  /**
   * Unregister agent-specific message handler
   */
  unregisterAgentHandler(agentId: string, messageType: MessageType): void {
    const handlers = this.agentHandlers.get(agentId);
    if (handlers) {
      handlers.delete(messageType);
      if (handlers.size === 0) {
        this.agentHandlers.delete(agentId);
      }
    }
  }

  /**
   * Request/response pattern - send message and wait for response
   */
  async requestResponse(
    targetAgentId: string,
    message: Message,
    timeout: number = 30000
  ): Promise<Message> {
    const correlationId = message.correlationId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    message.correlationId = correlationId;
    message.targetAgentId = targetAgentId;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(correlationId, { resolve, reject, timeout: timeoutId });

      // Subscribe to response messages
      const responseHandler = (response: Message) => {
        if (response.correlationId === correlationId && response.sourceAgentId === targetAgentId) {
          this.unsubscribe('agent_response', responseHandler);
          const pending = this.pendingRequests.get(correlationId);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(correlationId);
            resolve(response);
          }
        }
      };

      this.subscribe('agent_response', responseHandler);

      // Send the request
      this.sendDirectMessage(targetAgentId, message);
    });
  }

  /**
   * Broadcast message to all agents
   */
  broadcast(message: Message): void {
    message.targetAgentId = undefined; // No specific target
    this.publish(message);
    logger.debug(`Broadcast message: ${message.type}`);
  }
}

