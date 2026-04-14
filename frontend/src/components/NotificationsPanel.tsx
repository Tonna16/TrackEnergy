// src/components/NotificationsPanel.tsx
import React, { useState, useRef, useEffect } from 'react'
import { useNotificationsCtx } from '../context/NotificationsContext'
import { Bell, X, Info, AlertTriangle, CheckCircle } from 'lucide-react'

export default function NotificationsPanel() {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotificationsCtx()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const markAllAsRead = () => {
    notifications
      .filter(n => !n.read && !n.deleted)
      .forEach(n => markAsRead(n.id))
  }

  const formatRelativeTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Just now'

    const now = Date.now()
    const diffMs = date.getTime() - now
    const absSeconds = Math.round(Math.abs(diffMs) / 1000)
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

    if (absSeconds < 60) return rtf.format(Math.round(diffMs / 1000), 'second')

    const absMinutes = Math.round(absSeconds / 60)
    if (absMinutes < 60) return rtf.format(Math.round(diffMs / (60 * 1000)), 'minute')

    const absHours = Math.round(absMinutes / 60)
    if (absHours < 24) return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), 'hour')

    const absDays = Math.round(absHours / 24)
    if (absDays < 7) return rtf.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), 'day')

    return date.toLocaleString()
  }

  const renderIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 mr-1" />
      case 'alert':
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500 mr-1" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
      default:
        return <Info className="w-4 h-4 text-gray-400 mr-1" /> // fallback icon
    }
  }

  // Filter out deleted notifications before rendering
  const visibleNotifications = notifications.filter(n => !n.deleted)

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={bellRef}
        onClick={() => setOpen(prev => !prev)}
        aria-label="Toggle notifications"
        className="relative focus:outline-none rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <Bell className="w-6 h-6 text-gray-700 dark:text-gray-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full text-center leading-tight">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          style={{ overscrollBehavior: 'contain' }}
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-gray-800 shadow-lg rounded z-50 border border-gray-200 dark:border-gray-600"
        >
          {unreadCount > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Mark all as read
              </button>
            </div>
          )}
          {visibleNotifications.length === 0 ? (
            <div className="p-4 text-sm text-gray-600 dark:text-gray-300">
              No notifications
            </div>
          ) : (
            visibleNotifications.map(n => (
              <div
                role="option"
                key={n.id}
                onMouseEnter={() => !n.read && markAsRead(n.id)}
                onFocus={() => !n.read && markAsRead(n.id)}
                tabIndex={0}
                className={`relative p-4 border-b dark:border-gray-700 flex flex-col ${
                  n.read ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'
                }`}
              >
                {/* Delete Button */}
                <button
                  onClick={() => deleteNotification(n.id)}
                  className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
                  aria-label="Delete notification"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Icon + Title */}
                <div className="flex items-center mb-1">
                  {renderIcon(n.type)}
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {n.title || n.type}
                  </div>
                </div>

                {/* Message */}
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {n.message || 'No message provided.'}
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {n.category && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                      {n.category}
                    </span>
                  )}
                  <span>{formatRelativeTime(n.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
