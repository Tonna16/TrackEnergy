import { Client, Message } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { refreshAccessTokenIfNeeded } from './auth'

let client: Client | null = null
let connectPromise: Promise<void> | null = null

export async function connectWebSocket(onConnected?: () => void): Promise<void> {
  if (client && client.connected) {
    onConnected?.()
    return Promise.resolve()
  }
  if (connectPromise) {
    return connectPromise
  }

  const token = await refreshAccessTokenIfNeeded()
  if (!token) return Promise.reject(new Error('No valid token found for WebSocket connection'))

  const sockJSUrl = `http://localhost:8080/ws?token=${encodeURIComponent(token)}`

  client = new Client({
    webSocketFactory: () => new SockJS(sockJSUrl),
    reconnectDelay: 5000,
    debug: (str) => console.log('[STOMP DEBUG]', str),
  })

  connectPromise = new Promise((resolve, reject) => {
    client!.onConnect = () => {
      onConnected?.()
      resolve()
    }

    client!.onStompError = (err) => {
      console.error('STOMP error', err)
      reject(err)
    }

    client!.onWebSocketError = (err) => {
      console.error('WebSocket error', err)
    }

    client!.onDisconnect = () => {
      connectPromise = null
      client = null
    }

    if (!client!.active && !client!.connected) {
      client!.activate()
    }
  })

  return connectPromise
}

/**
 * Subscribes to user's notification topic.
 * Throws if WebSocket not connected.
 */
export function subscribeToNotifications(
  userId: string,
  handler: (body: string) => void
): () => void {
  if (!client || !client.connected) {
    throw new Error('WebSocket not connected')
  }

  const subscription = client.subscribe(`/topic/notifications/${userId}`, (message) => {
    handler(message.body)
  })

  return () => {
    subscription.unsubscribe()
  }
}
