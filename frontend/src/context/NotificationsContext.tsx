import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
  useMemo,
} from 'react';
import api from '../utils/api';
import { connectWebSocket, subscribeToNotifications } from '../utils/websocket';
import { getAuthToken } from '../utils/auth';

export interface Notification {
  id: number;
  type: 'alert' | 'system' | 'info' | 'warning' | 'success';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  deleted: boolean;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (opts: {
    type: Notification['type'];
    title: string;
    message: string;
    weekStartDate?: string;
    actualUsage?: number;
    forecastUsage?: number;
  }) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  notifyForecastMode: (mode: string) => Promise<void>;
  notifyHighUsageAppliance: (name: string, estimatedKWh: number) => Promise<void>;
  notifyExchangeRate: (
    newCurrency: string,
    exchangeRate: number,
    electricityRate: number,
    date: string
  ) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | undefined>();
  const [wsConnected, setWsConnected] = useState(false);

  const getUserIdFromToken = (): string | null => {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || null;
    } catch {
      return null;
    }
  };

  const loadInitialNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get<Notification[]>('notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    const userId = getUserIdFromToken() ?? 'guest'; // Fallback to 'guest' for anonymous users
    let mounted = true;
  
    const setupWs = async () => {
      console.log('[NotificationsProvider] Setting up for user:', userId);
      setLoading(true);
  
      if (token) {
        try {
          await loadInitialNotifications(); // only fetch for logged-in users
        } catch (e) {
          console.warn('[NotificationsProvider] Failed to load initial notifications');
        }
      }
  
      try {
        await connectWebSocket(() => {
          if (!mounted) return;
          setWsConnected(true);
          console.log('[NotificationsProvider] WebSocket connected');
        });
  
        unsubscribeRef.current?.();
        unsubscribeRef.current = subscribeToNotifications(userId, (body) => {
          const n: Notification = typeof body === 'string' ? JSON.parse(body) : body;
          setNotifications((prev) => {
            if (n.deleted) return prev.filter(x => x.id !== n.id);
            const idx = prev.findIndex(x => x.id === n.id);
            if (idx !== -1) {
              const copy = [...prev];
              copy[idx] = n;
              return copy;
            }
            return [n, ...prev];
          });
        });
  
        console.log('[NotificationsProvider] Subscribed to topic:', userId);
      } catch (err) {
        console.error('[NotificationsProvider] WebSocket error:', err);
        setWsConnected(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };
  
    setupWs();
  
    return () => {
      mounted = false;
      unsubscribeRef.current?.();
      console.log('[NotificationsProvider] Cleaned up subscription');
    };
  }, []);
  

  // Stub implementations—reuse your existing logic here:
  const addNotification = async (opts: {
    type: Notification['type'];
    title: string;
    message: string;
    weekStartDate?: string;
    actualUsage?: number;
    forecastUsage?: number;
  }) => {
    try {
      await api.post('notifications', opts);
    } catch (err) {
      console.error('[addNotification] Failed to add notification:', err);
    }
  };
  const markAsRead = async (id: number) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.deleted) return;  // skip deleted
    try {
      await api.patch(`notifications/${id}/read`);
    } catch (err) {
      console.error(`[markAsRead] Failed to mark notification ${id} as read:`, err);
    }
  };
  
  const deleteNotification = async (id: number) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.deleted) return;  // skip deleted
    try {
      await api.delete(`notifications/${id}`);
    } catch (err) {
      console.error(`[deleteNotification] Failed to delete notification ${id}:`, err);
    }
  };
  
  const notifyForecastMode = async (mode: string) => {
    try {
      await api.post('notifications/forecast-mode', { mode });
    } catch (err) {
      console.error('[notifyForecastMode] Failed to notify:', err);
    }
  };
  const notifyHighUsageAppliance = async (name: string, estimatedKWh: number) => {
    try {
      await api.post('notifications/high-usage', {
        appliance: name,
        estimatedKWh,
      });
    } catch (err) {
      console.error('[notifyHighUsageAppliance] Failed to notify:', err);
    }
  };
  const notifyExchangeRate = async (
    newCurrency: string,
    exchangeRate: number,
    electricityRate: number,
    date: string
  ) => {
    try {
      await api.post('notifications/exchange-rate', {
        newCurrency,
        exchangeRate,
        electricityRate,
        date,
      });
    } catch (err) {
      console.error('[notifyExchangeRate] Failed to notify:', err);
    }
  };
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

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
  );
};

export const useNotificationsCtx = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // guest fallback
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
    };
  }
  return ctx;
};
