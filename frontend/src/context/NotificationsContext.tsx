// src/context/NotificationsContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import axios from 'axios'
import { connectWebSocket, subscribeToNotifications } from '../utils/websocket'
import { useAppContext } from './AppContext'

export interface Notification {
  id: number
  type: 'alert' | 'system' | 'info' | 'warning' | 'success'
  title: string
  message: string
  createdAt: string
  read: boolean
}

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: number) => Promise<void>
  deleteNotification: (id: number) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [serverNotifications, setServerNotifications] = useState<Notification[]>([])
  const { notifications: localNotifications } = useAppContext()

  const loadInitial = async () => {
    try {
      const res = await axios.get<Notification[]>('/notifications')
      setServerNotifications(res.data)
    } catch (e) {
      console.error('Failed to load server notifications:', e)
    }
  }

  const normalizedLocal: Notification[] = localNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title || n.message,
    message: n.message,
    createdAt: n.createdAt,
    read: n.read ?? false,
  }))

  const mergedNotifications = [
    ...serverNotifications,
    ...normalizedLocal.filter(
      (local) => !serverNotifications.some((server) => server.id === local.id)
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const userId = user?.id?.toString()
    if (!userId) return

    loadInitial()

    let unsubscribe: (() => void) | undefined

    connectWebSocket(() => {}).then(() => {
      unsubscribe = subscribeToNotifications(userId, (body) => {
        try {
          const n: Notification = JSON.parse(body)
          setServerNotifications((prev) => [n, ...prev])
        } catch (err) {
          console.warn('Invalid notification payload:', err)
        }
      })
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const markAsRead = async (id: number) => {
    await axios.post(`/notifications/${id}/read`)
    setServerNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const deleteNotification = async (id: number) => {
    await axios.delete(`/notifications/${id}`)
    setServerNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadCount = mergedNotifications.filter((n) => !n.read).length

  return (
    <NotificationsContext.Provider
      value={{
        notifications: mergedNotifications,
        unreadCount,
        markAsRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotificationsCtx = () => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsCtx must be used within NotificationsProvider')
  return ctx
}
