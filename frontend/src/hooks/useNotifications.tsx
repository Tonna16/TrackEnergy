import { useEffect, useState } from 'react'
import axios from 'axios'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

export type NotificationType = 'alert' | 'system'

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  createdAt: string
  read: boolean
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  // Load server notifications on mount
  useEffect(() => {
    if (!userId) return
    setLoading(true)
    axios
      .get<Notification[]>('/notifications')
      .then((res) => {
        const sorted = res.data.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setNotifications(sorted)
      })
      .catch((err) => {
        console.error('Notifications fetch failed:', err.response?.status, err)
      })
      .finally(() => setLoading(false))
  }, [userId])

  // Live notifications via STOMP WebSocket
  useEffect(() => {
    if (!userId) return

    const socket = new SockJS('/ws')
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (msg) => console.debug('STOMP:', msg),
    })

    client.onConnect = () => {
      client.subscribe(`/topic/notifications/${userId}`, (msg) => {
        try {
          const incoming: Notification = JSON.parse(msg.body)

          setNotifications((prev) => {
            // Prevent duplicates
            if (prev.some((n) => n.id === incoming.id)) return prev
            return [incoming, ...prev].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
          })
        } catch (e) {
          console.error('Invalid notification format:', msg.body)
        }
      })
    }

    client.activate()
    return () => {
      client.deactivate()
    }
  }, [userId])

  const markAsRead = async (id: number) => {
    try {
      await axios.post(`/notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await axios.delete(`/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    markAsRead,
    deleteNotification,
  }
}
