import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useMemo,
} from 'react'
import api from '../utils/api'
import { connectWebSocket, subscribeToNotifications } from '../utils/websocket'
import { getAuthToken } from '../utils/auth'

export interface Notification {
  id: number
  type: 'alert' | 'system' | 'info' | 'warning' | 'success'
  title: string
  message: string
  createdAt: string
  read: boolean
  deleted: boolean // made non-optional for clarity
}

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  addNotification: (opts: {
    type: Notification['type']
    title: string
    message: string
    weekStartDate?: string
    actualUsage?: number
    forecastUsage?: number
  }) => Promise<void>
  markAsRead: (id: number) => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  notifyForecastMode: (mode: string) => Promise<void>
  notifyHighUsageAppliance: (name: string, estimatedKWh: number) => Promise<void>
  notifyExchangeRate: (
    newCurrency: string,
    exchangeRate: number,
    electricityRate: number,
    date: string
  ) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const unsubscribeRef = useRef<(() => void) | undefined>()
  const [wsConnected, setWsConnected] = useState(false)

  const getUserIdFromToken = (): string | null => {
    try {
      const token = getAuthToken()
      if (!token) return null
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.sub || null
    } catch {
      return null
    }
  }

  const loadInitialNotifications = async () => {
    try {
      setLoading(true)
      const res = await api.get<Notification[]>('notifications')
      setNotifications(res.data)
    } catch (e) {
      console.error('Failed to load notifications:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const userId = getUserIdFromToken()
    if (!userId) {
      setLoading(false) // no user, no notifications
      return
    }

    const setup = async () => {
      try {
        setLoading(true)
        await loadInitialNotifications()

        await connectWebSocket(() => setWsConnected(true))

        unsubscribeRef.current = subscribeToNotifications(userId, (body) => {
          try {
            const n: Notification = typeof body === 'string' ? JSON.parse(body) : body
            if (!n) return

            setNotifications((prev) => {
              if (n.deleted) {
                // Remove deleted notification
                return prev.filter((x) => x.id !== n.id)
              }
              // Update existing or add new
              const index = prev.findIndex((x) => x.id === n.id)
              if (index !== -1) {
                const newArr = [...prev]
                newArr[index] = n
                return newArr
              }
              return [n, ...prev]
            })
          } catch (err) {
            console.warn('Invalid notification payload:', err)
          }
        })
      } catch (err) {
        console.error('WebSocket connection error:', err)
        setWsConnected(false)
      } finally {
        setLoading(false)
      }
    }

    setup()

    return () => {
      unsubscribeRef.current?.()
    }
  }, [])

  const addNotification = async (opts: {
    type: Notification['type']
    title: string
    message: string
    weekStartDate?: string
    actualUsage?: number
    forecastUsage?: number
  }) => {
    try {
      let res
      if (
        opts.weekStartDate &&
        opts.actualUsage !== undefined &&
        opts.forecastUsage !== undefined
      ) {
        res = await api.post<Notification>('notifications/weekly-comparison', {
          weekStartDate: opts.weekStartDate,
          actualUsage: opts.actualUsage,
          forecastUsage: opts.forecastUsage,
        })
      } else {
        res = await api.post<Notification>('notifications', {
          type: opts.type,
          title: opts.title,
          message: opts.message,
        })
      }
      setNotifications((prev) => [res.data, ...prev])
    } catch (e) {
      console.error('Failed to create notification:', e)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.post(`notifications/${id}/read`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (e) {
      console.error('Failed to mark notification as read:', e)
    }
  }

  const deleteNotification = async (id: number) => {
    try {
      await api.delete(`notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (e) {
      console.error('Failed to delete notification:', e)
    }
  }

  const notifyForecastMode = async (mode: string) => {
    try {
      const res = await api.post<Notification>('notifications/forecast-mode', { mode })
      setNotifications((prev) => [res.data, ...prev])
    } catch (e) {
      console.error('Failed to notify forecast mode:', e)
    }
  }

  const notifyHighUsageAppliance = async (name: string, estimatedKWh: number) => {
    try {
      const res = await api.post<Notification>('notifications/high-usage-appliance', {
        name,
        estimatedKWh,
      })
      setNotifications((prev) => [res.data, ...prev])
    } catch (e) {
      console.error('Failed to notify high usage appliance:', e)
    }
  }

  const notifyExchangeRate = async (
    newCurrency: string,
    exchangeRate: number,
    electricityRate: number,
    date: string
  ) => {
    try {
      const res = await api.post<Notification>('notifications/exchange-rate', {
        newCurrency,
        exchangeRate,
        electricityRate,
        date,
      })
      setNotifications((prev) => [res.data, ...prev])
    } catch (e) {
      console.error('Failed to notify exchange rate update:', e)
    }
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        addNotification,
        markAsRead,
        deleteNotification,
        notifyForecastMode,
        notifyHighUsageAppliance,
        notifyExchangeRate,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export const useNotificationsCtx = () => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    // Fallback for guests: no-ops
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      addNotification: async () => {},
      markAsRead: async () => {},
      deleteNotification: async () => {},
      notifyForecastMode: async () => {},
      notifyHighUsageAppliance: async () => {},
      notifyExchangeRate: async () => {},
    }
  }
  return ctx
}
