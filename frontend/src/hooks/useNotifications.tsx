import { useEffect, useState } from 'react';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export type NotificationType = 'alert' | 'system';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // 1) Fetch existing notifications
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    axios
      .get<Notification[]>('/notifications')
      .then((res) => setNotifications(res.data))
      .catch((err) => {
        console.error('Notifications fetch failed:', err.response?.status, err);
        // on 401/403 you might clear token and redirect to /login
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // 2) Real‑time via SockJS (proxied by Vite to ws://localhost:8080/ws)
  useEffect(() => {
    if (!userId) return;
    const socket = new SockJS('/ws');
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      // Axios interceptor already attaches the JWT for you
      debug: (m) => console.debug('STOMP:', m),
    });
    client.onConnect = () => {
      client.subscribe(`/topic/notifications/${userId}`, (msg) => {
        const n: Notification = JSON.parse(msg.body);
        setNotifications((prev) => [n, ...prev]);
      });
    };
    client.activate();
    return () => void client.deactivate();
  }, [userId]);

  async function markAsRead(id: number) {
    await axios.post(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async function deleteNotification(id: number) {
    await axios.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    markAsRead,
    deleteNotification,
  };
}
