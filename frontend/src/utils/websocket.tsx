import type { Client as StompClient } from '@stomp/stompjs'
import { refreshAccessTokenIfNeeded } from './auth'

let client: StompClient | null = null
let connectPromise: Promise<void> | null = null

function buildSockJsUrl(token: string): string {
  const configuredUrl = import.meta.env.VITE_WS_URL?.trim()
  const wsUrl = configuredUrl && configuredUrl.length > 0 ? configuredUrl : '/ws'

  const baseUrl = /^https?:\/\//i.test(wsUrl)
    ? new URL(wsUrl)
    : new URL(wsUrl.startsWith('/') ? wsUrl : `/${wsUrl}`, window.location.origin)

  baseUrl.searchParams.set('token', token)
  return baseUrl.toString()
}

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

  // Keep browser-only WebSocket dependencies out of the backend-free demo
  // bundle. This function is reached only by the optional full-stack mode.
  const [{ Client }, { default: SockJS }] = await Promise.all([
    import('@stomp/stompjs'),
    import('sockjs-client'),
  ])
  const sockJSUrl = buildSockJsUrl(token)

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
