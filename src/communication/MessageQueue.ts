/**
 * Message queue for orchestrator coordination
 */

import { EventEmitter } from 'events';
import type { Message, MessageType } from './types.js';
import logger from '../utils/logger.js';

export class MessageQueue extends EventEmitter {
  private messages: Message[] = [];
  private maxHistory: number = 1000;

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
}

