/**
 * MessageQueue unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageQueue } from './MessageQueue.js';
import { createTestMessage } from '../../__tests__/helpers/factories.js';
import type { Message, MessageType } from './types.js';

describe('MessageQueue', () => {
  let messageQueue: MessageQueue;

  beforeEach(() => {
    messageQueue = new MessageQueue();
  });

  describe('publish', () => {
    it('should publish a message', () => {
      const message = createTestMessage('task_completed', { data: 'test' });
      
      const handler = vi.fn();
      messageQueue.subscribe('task_completed', handler);
      
      messageQueue.publish(message);
      
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should emit generic message event', () => {
      const message = createTestMessage('task_completed', { data: 'test' });
      
      const handler = vi.fn();
      messageQueue.subscribeToAll(handler);
      
      messageQueue.publish(message);
      
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should add message to history', () => {
      const message = createTestMessage('task_completed', { data: 'test' });
      messageQueue.publish(message);
      
      const history = messageQueue.getHistory();
      expect(history).toContain(message);
    });

    it('should trim history when exceeding maxHistory', () => {
      const maxHistory = 1000;
      // Publish more than maxHistory messages
      for (let i = 0; i < maxHistory + 100; i++) {
        messageQueue.publish(createTestMessage('task_completed', { index: i }));
      }
      
      const history = messageQueue.getHistory();
      expect(history.length).toBeLessThanOrEqual(maxHistory);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to specific message type', () => {
      const handler = vi.fn();
      messageQueue.subscribe('task_completed', handler);
      
      const message = createTestMessage('task_completed', { taskId: '123' });
      messageQueue.publish(message);
      
      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should not call handler for other message types', () => {
      const handler = vi.fn();
      messageQueue.subscribe('task_completed', handler);
      
      const message = createTestMessage('task_failed', { taskId: '123' });
      messageQueue.publish(message);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToAll', () => {
    it('should subscribe to all messages', () => {
      const handler = vi.fn();
      messageQueue.subscribeToAll(handler);
      
      const message1 = createTestMessage('task_completed', {});
      const message2 = createTestMessage('task_failed', {});
      
      messageQueue.publish(message1);
      messageQueue.publish(message2);
      
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from message type', () => {
      const handler = vi.fn();
      messageQueue.subscribe('task_completed', handler);
      messageQueue.unsubscribe('task_completed', handler);
      
      const message = createTestMessage('task_completed', {});
      messageQueue.publish(message);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return all messages when no filter', () => {
      const message1 = createTestMessage('task_completed', {});
      const message2 = createTestMessage('task_failed', {});
      
      messageQueue.publish(message1);
      messageQueue.publish(message2);
      
      const history = messageQueue.getHistory();
      expect(history).toHaveLength(2);
      expect(history).toContain(message1);
      expect(history).toContain(message2);
    });

    it('should filter messages when filter provided', () => {
      const message1 = createTestMessage('task_completed', { value: 1 });
      const message2 = createTestMessage('task_completed', { value: 2 });
      const message3 = createTestMessage('task_failed', { value: 3 });
      
      messageQueue.publish(message1);
      messageQueue.publish(message2);
      messageQueue.publish(message3);
      
      const filtered = messageQueue.getHistory(msg => msg.type === 'task_completed');
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(message1);
      expect(filtered).toContain(message2);
      expect(filtered).not.toContain(message3);
    });
  });

  describe('getMessagesByType', () => {
    it('should return messages of specific type', () => {
      const message1 = createTestMessage('task_completed', {});
      const message2 = createTestMessage('task_failed', {});
      const message3 = createTestMessage('task_completed', {});
      
      messageQueue.publish(message1);
      messageQueue.publish(message2);
      messageQueue.publish(message3);
      
      const completed = messageQueue.getMessagesByType('task_completed');
      expect(completed).toHaveLength(2);
      expect(completed).toContain(message1);
      expect(completed).toContain(message3);
    });

    it('should return empty array when no messages of type', () => {
      const messages = messageQueue.getMessagesByType('error');
      expect(messages).toHaveLength(0);
    });
  });

  describe('getMessagesForAgent', () => {
    it('should return messages for agent as source', () => {
      const message = createTestMessage('task_completed', {}, { sourceAgentId: 'agent-1' });
      messageQueue.publish(message);
      
      const messages = messageQueue.getMessagesForAgent('agent-1');
      expect(messages).toContain(message);
    });

    it('should return messages for agent as target', () => {
      const message = createTestMessage('task_completed', {}, { targetAgentId: 'agent-1' });
      messageQueue.publish(message);
      
      const messages = messageQueue.getMessagesForAgent('agent-1');
      expect(messages).toContain(message);
    });

    it('should return messages for both source and target', () => {
      const message1 = createTestMessage('task_completed', {}, { sourceAgentId: 'agent-1' });
      const message2 = createTestMessage('task_failed', {}, { targetAgentId: 'agent-1' });
      
      messageQueue.publish(message1);
      messageQueue.publish(message2);
      
      const messages = messageQueue.getMessagesForAgent('agent-1');
      expect(messages).toHaveLength(2);
    });
  });

  describe('clearHistory', () => {
    it('should clear all message history', () => {
      messageQueue.publish(createTestMessage('task_completed', {}));
      messageQueue.publish(createTestMessage('task_failed', {}));
      
      messageQueue.clearHistory();
      
      expect(messageQueue.getHistory()).toHaveLength(0);
    });
  });

  describe('waitForMessage', () => {
    it('should wait for specific message type', async () => {
      const promise = messageQueue.waitForMessage('task_completed');
      
      // Publish message after a short delay
      setTimeout(() => {
        messageQueue.publish(createTestMessage('task_completed', { taskId: '123' }));
      }, 10);
      
      const message = await promise;
      expect(message).toBeDefined();
      expect(message?.type).toBe('task_completed');
    });

    it('should timeout when message not received', async () => {
      const promise = messageQueue.waitForMessage('task_completed', 50);
      
      const message = await promise;
      expect(message).toBeNull();
    });

    it('should filter messages when filter provided', async () => {
      const promise = messageQueue.waitForMessage(
        'task_completed',
        1000,
        (msg: Message) => (msg.payload as any).taskId === 'target'
      );
      
      // Publish message that doesn't match filter
      setTimeout(() => {
        messageQueue.publish(createTestMessage('task_completed', { taskId: 'other' }));
      }, 10);
      
      // Publish message that matches filter
      setTimeout(() => {
        messageQueue.publish(createTestMessage('task_completed', { taskId: 'target' }));
      }, 30);
      
      const message = await promise;
      expect(message).toBeDefined();
      expect((message?.payload as any).taskId).toBe('target');
    });
  });

  describe('sendDirectMessage', () => {
    it('should send to specific agent', () => {
      const message = createTestMessage('agent_message', { data: 'test' });
      const handler = vi.fn();
      
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalledWith(message);
      expect(message.targetAgentId).toBe('agent-1');
    });

    it('should trigger agent handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', { data: 'test' });
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', () => {
      const handler = vi.fn(() => {
        throw new Error('Handler error');
      });
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', { data: 'test' });
      
      expect(() => messageQueue.sendDirectMessage('agent-1', message)).not.toThrow();
    });
  });

  describe('registerAgentHandler', () => {
    it('should register handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', {});
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should support multiple handlers for same agent', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler1);
      messageQueue.registerAgentHandler('agent-1', 'task_completed', handler2);
      
      const message1 = createTestMessage('agent_message', {});
      const message2 = createTestMessage('task_completed', {});
      
      messageQueue.sendDirectMessage('agent-1', message1);
      messageQueue.sendDirectMessage('agent-1', message2);
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregisterAgentHandler', () => {
    it('should unregister handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      messageQueue.unregisterAgentHandler('agent-1', 'agent_message');
      
      const message = createTestMessage('agent_message', {});
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('requestResponse', () => {
    it('should send request and wait for response', async () => {
      const request = createTestMessage('agent_request', { requestId: '123' });
      
      // Set up response handler
      setTimeout(() => {
        const response = createTestMessage('agent_response', { requestId: '123' }, {
          sourceAgentId: 'agent-1',
          correlationId: request.correlationId,
        });
        messageQueue.publish(response);
      }, 10);
      
      const response = await messageQueue.requestResponse('agent-1', request, 1000);
      
      expect(response).toBeDefined();
      expect(response.type).toBe('agent_response');
    });

    it('should timeout when no response', async () => {
      const request = createTestMessage('agent_request', {});
      
      await expect(
        messageQueue.requestResponse('agent-1', request, 50)
      ).rejects.toThrow('timeout');
    });

    it('should match correlation ID', async () => {
      const request = createTestMessage('agent_request', {}, { correlationId: 'corr-123' });
      
      setTimeout(() => {
        const response = createTestMessage('agent_response', {}, {
          sourceAgentId: 'agent-1',
          correlationId: 'corr-123',
        });
        messageQueue.publish(response);
      }, 10);
      
      const response = await messageQueue.requestResponse('agent-1', request, 1000);
      expect(response.correlationId).toBe('corr-123');
    });
  });

  describe('broadcast', () => {
    it('should send to all agents', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      messageQueue.subscribe('broadcast_message', handler1);
      messageQueue.subscribe('broadcast_message', handler2);
      
      const message = createTestMessage('broadcast_message', { data: 'test' });
      messageQueue.broadcast(message);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(message.targetAgentId).toBeUndefined();
    });
  });

  describe('sendMessageToAgent', () => {
    it('should send to specific agent', () => {
      const message = createTestMessage('agent_message', { data: 'test' });
      const handler = vi.fn();
      
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalledWith(message);
      expect(message.targetAgentId).toBe('agent-1');
    });

    it('should trigger agent handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', { data: 'test' });
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', () => {
      const handler = vi.fn(() => {
        throw new Error('Handler error');
      });
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', { data: 'test' });
      
      expect(() => messageQueue.sendDirectMessage('agent-1', message)).not.toThrow();
    });
  });

  describe('registerAgentHandler', () => {
    it('should register handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      
      const message = createTestMessage('agent_message', {});
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).toHaveBeenCalled();
    });

    it('should support multiple handlers for same agent', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler1);
      messageQueue.registerAgentHandler('agent-1', 'task_completed', handler2);
      
      const message1 = createTestMessage('agent_message', {});
      const message2 = createTestMessage('task_completed', {});
      
      messageQueue.sendDirectMessage('agent-1', message1);
      messageQueue.sendDirectMessage('agent-1', message2);
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('unregisterAgentHandler', () => {
    it('should unregister handler', () => {
      const handler = vi.fn();
      messageQueue.registerAgentHandler('agent-1', 'agent_message', handler);
      messageQueue.unregisterAgentHandler('agent-1', 'agent_message');
      
      const message = createTestMessage('agent_message', {});
      messageQueue.sendDirectMessage('agent-1', message);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('requestResponse', () => {
    it('should send request and wait for response', async () => {
      const request = createTestMessage('agent_request', { requestId: '123' });
      
      // Set up response handler - need to publish with correct type
      setTimeout(() => {
        const response = createTestMessage('agent_response', { requestId: '123' }, {
          sourceAgentId: 'agent-1',
          correlationId: request.correlationId || request.id,
        });
        // Publish as agent_response type
        messageQueue.publish(response);
      }, 10);
      
      const response = await messageQueue.requestResponse('agent-1', request, 1000);
      
      expect(response).toBeDefined();
      expect(response.type).toBe('agent_response');
    }, 2000);

    it('should timeout when no response', async () => {
      const request = createTestMessage('agent_request', {});
      
      await expect(
        messageQueue.requestResponse('agent-1', request, 50)
      ).rejects.toThrow('timeout');
    }, 2000);

    it('should match correlation ID', async () => {
      const request = createTestMessage('agent_request', {}, { correlationId: 'corr-123' });
      
      setTimeout(() => {
        const response = createTestMessage('agent_response', {}, {
          sourceAgentId: 'agent-1',
          correlationId: 'corr-123',
        });
        messageQueue.publish(response);
      }, 10);
      
      const response = await messageQueue.requestResponse('agent-1', request, 1000);
      expect(response.correlationId).toBe('corr-123');
    }, 2000);
  });

  describe('broadcast', () => {
    it('should send to all agents', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      messageQueue.subscribe('broadcast_message', handler1);
      messageQueue.subscribe('broadcast_message', handler2);
      
      const message = createTestMessage('broadcast_message', { data: 'test' });
      messageQueue.broadcast(message);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(message.targetAgentId).toBeUndefined();
    });
  });
});

