/**
 * WebSocket server for real-time updates
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Swarm } from '../../../src/index.js';
import { MessageQueue } from '../../../src/communication/MessageQueue.js';
import logger from '../../../src/utils/logger.js';

interface ClientConnection {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, ClientConnection>();

export function setupWebSocket(wss: WebSocketServer, getSwarm: () => Swarm): void {
  // Subscribe to message queue for updates
  const swarm = getSwarm();
  const messageQueue = swarm.getMessageQueue();

  // Subscribe to all messages
  messageQueue.subscribeToAll((message) => {
    broadcastToSubscribers(message.type, {
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp,
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const connection: ClientConnection = {
      ws,
      id: clientId,
      subscriptions: new Set(),
    };

    clients.set(clientId, connection);

    logger.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    }));

    // Handle messages from client
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(clientId, message, getSwarm);
      } catch (error) {
        logger.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
        }));
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      logger.info(`WebSocket client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
      clients.delete(clientId);
    });
  });

  logger.info('WebSocket server initialized');
}

function handleClientMessage(
  clientId: string,
  message: any,
  getSwarm: () => Swarm
): void {
  const connection = clients.get(clientId);
  if (!connection) return;

  switch (message.type) {
    case 'subscribe':
      // Subscribe to specific event types
      if (Array.isArray(message.events)) {
        message.events.forEach((event: string) => {
          connection.subscriptions.add(event);
        });
        connection.ws.send(JSON.stringify({
          type: 'subscribed',
          events: Array.from(connection.subscriptions),
        }));
      }
      break;

    case 'unsubscribe':
      // Unsubscribe from event types
      if (Array.isArray(message.events)) {
        message.events.forEach((event: string) => {
          connection.subscriptions.delete(event);
        });
        connection.ws.send(JSON.stringify({
          type: 'unsubscribed',
          events: Array.from(connection.subscriptions),
        }));
      }
      break;

    case 'ping':
      // Heartbeat
      connection.ws.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString(),
      }));
      break;

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

function broadcastToSubscribers(eventType: string, data: any): void {
  clients.forEach((connection) => {
    // Send if subscribed to this event type or subscribed to 'all'
    if (
      connection.subscriptions.has(eventType) ||
      connection.subscriptions.has('all')
    ) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify({
          type: 'event',
          event: eventType,
          data,
        }));
      }
    }
  });
}

