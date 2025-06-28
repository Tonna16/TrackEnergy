import React, { useState, useRef, useEffect } from 'react';
import { useNotificationsCtx } from '../context/NotificationsContext';
import { Bell } from 'lucide-react';

export default function NotificationsPanel() {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotificationsCtx();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close dropdown if clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Toggle notifications"
        aria-expanded={open}
        className="relative focus:outline-none"
      >
        <Bell className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-block w-4 h-4 bg-red-500 text-white text-xs rounded-full text-center leading-tight">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg rounded transition-opacity duration-150 ease-in z-50">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-2 border-b dark:border-gray-700 ${
                n.read ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-gray-100">{n.title}</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{n.message}</div>
              <div className="flex justify-end space-x-2 mt-1">
                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="text-blue-500 dark:text-blue-400 text-xs"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="text-red-500 dark:text-red-400 text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="p-2 text-sm text-gray-600 dark:text-gray-300">
              No notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}
