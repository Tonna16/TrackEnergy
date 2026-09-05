import {
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
import { useAppContext } from './AppContext';

export interface Notification {
  id: number;
  type: 'alert' | 'system' | 'info' | 'warning' | 'success';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  deleted: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  actionUrl?: string;
  dedupeKey?: string;
  expiresAt?: string;
}

export interface NotificationPayload {
  type: Notification['type'];
  title: string;
  message: string;
  weekStartDate?: string;
  actualUsage?: number;
  forecastUsage?: number;
  severity?: Notification['severity'];
  category?: string;
  actionUrl?: string;
  dedupeKey?: string;
  expiresAt?: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (opts: NotificationPayload) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  notifyForecastMode: (mode: string) => Promise<void>;
  notifyHighUsageAppliance: (name: string, estimatedKWh: number) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { authReady, authStatus, backendEnabled } = useAppContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubscribeRef = useRef<(() => void) | undefined>();

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
    if (!authReady) {
      setLoading(true);
      return;
    }

    if (!backendEnabled) {
      setLoading(false);
      return;
    }
    const token = getAuthToken();
    const userId = getUserIdFromToken();
    let mounted = true;
  
    const setupWs = async () => {
      if (!token || !userId) {
        unsubscribeRef.current?.();
        unsubscribeRef.current = undefined;
        setNotifications([]);
        if (mounted) setLoading(false);
        return;
      }

      console.log('[NotificationsProvider] Setting up for user:', userId);
      setLoading(true);
  
      try {
        await loadInitialNotifications(); // only fetch for logged-in users
      } catch {
        console.warn('[NotificationsProvider] Failed to load initial notifications');
      }
  
      try {
        await connectWebSocket(() => {
          if (!mounted) return;
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
  }, [authReady, authStatus, backendEnabled]);
  

  // Stub implementations—reuse your existing logic here:
  const addNotification = async (opts: NotificationPayload) => {
    if (!backendEnabled || !getAuthToken()) {
      setNotifications(previous => [{
        id: Date.now(),
        ...opts,
        createdAt: new Date().toISOString(),
        read: false,
        deleted: false,
      }, ...previous]);
      return;
    }
    try {
      await api.post('notifications', opts);
    } catch (err) {
      console.error('[addNotification] Failed to add notification:', err);
    }
  };
  const markAsRead = async (id: number) => {
    if (!backendEnabled || !getAuthToken()) {
      setNotifications(previous => previous.map(item => item.id === id ? { ...item, read: true } : item));
      return;
    }
    try {
      await api.post(`notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error(`[markAsRead] Failed to mark notification ${id} as read:`, err);
    }
  };
  
  const deleteNotification = async (id: number) => {
    if (!backendEnabled || !getAuthToken()) {
      setNotifications(previous => previous.filter(item => item.id !== id));
      return;
    }
    try {
      await api.delete(`notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(`[deleteNotification] Failed to delete notification ${id}:`, err);
    }
  };
  
  const notifyForecastMode = async (mode: string) => {
    if (!backendEnabled || !getAuthToken()) return;
    try {
      await api.post('notifications/forecast-mode', { mode });
    } catch (err) {
      console.error('[notifyForecastMode] Failed to notify:', err);
    }
  };
  const notifyHighUsageAppliance = async (name: string, estimatedKWh: number) => {
    if (!backendEnabled || !getAuthToken()) return;
    try {
      await api.post('notifications/high-usage-appliance', {
        appliance: name,
        estimatedKWh,
      });
    } catch (err) {
      console.error('[notifyHighUsageAppliance] Failed to notify:', err);
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
    };
  }
  return ctx;
};
