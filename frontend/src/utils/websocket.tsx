import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let client: Client | null = null;

/**
 * Initializes the STOMP client (singleton) and connects.
 * Returns a promise that resolves when connected.
 */
export function connectWebSocket(onMessage: (msg: Message) => void): Promise<void> {
  if (client?.connected) return Promise.resolve();

  return new Promise((resolve, reject) => {
    client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      debug: () => {}, 
    });
    client.onConnect = () => {
      resolve();
    };
    client.onStompError = (err) => {
      console.error('STOMP error', err);
      reject(err);
    };
    client.activate();
    client.onWebSocketError = (err) => {
      console.error('WebSocket error', err);
    };
    // Message handler will be attached per subscription below
    client.onConnect = () => resolve();
  });
}

/**
 * Subscribe to the user’s notification topic.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  handler: (body: string) => void
): () => void {
  if (!client) throw new Error('WebSocket client not initialized');
  const sub = client.subscribe(
    `/topic/notifications/${userId}`,
    (message) => handler(message.body)
  );
  return () => {
    sub.unsubscribe();
  };
}
