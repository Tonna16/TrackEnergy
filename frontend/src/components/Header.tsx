// src/components/Header.tsx
import { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Bell,
  Moon,
  Sun,
  Settings,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNotifications } from '../hooks/useNotifications';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { jwtDecode } from 'jwt-decode';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

interface JwtPayload {
  sub: string;
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { settings, updateSettings } = useAppContext();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // Decode userId from JWT
  const token = localStorage.getItem('token');
  const userId = token ? (jwtDecode<JwtPayload>(token).sub) : '';

  const { notifications, markAsRead, unreadCount, deleteNotification } =
    useNotifications(userId);

  // Sync auth state
  const [isLoggedIn, setIsLoggedIn] = useState(!!token);
  useEffect(() => {
    const onStorage = () => setIsLoggedIn(!!localStorage.getItem('token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Dark mode toggle
  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
  };

  // Close notifications dropdown on outside click
  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node) &&
      bellRef.current &&
      !bellRef.current.contains(event.target as Node)
    ) {
      setNotificationsOpen(false);
    }
  };
  useEffect(() => {
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notificationsOpen]);

  return (
    <header className="bg-offwhite-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
        {/* Sidebar & Brand */}
        <div className="flex items-center">
          <button
            type="button"
            className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden md:flex items-center text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            EnergyIQ
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4 relative">
          {/* Notifications */}
          <button
            ref={bellRef}
            type="button"
            className="relative rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            onClick={() => setNotificationsOpen((o) => !o)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-16 mt-2 w-80 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-xl border border-gray-200 dark:border-gray-600 rounded-lg z-50"
            >
              <div className="p-4 max-h-[24rem] overflow-y-auto">
                <h3 className="font-semibold text-lg mb-3">Notifications</h3>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    No new notifications.
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 mb-3 rounded-md ${
                        n.read ? 'bg-gray-100 dark:bg-gray-600' : 'bg-emerald-50 dark:bg-emerald-900'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-300">
                          {n.type}
                        </span>
                        <button
                          onClick={() => deleteNotification(n.id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Delete"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <p className="text-sm mt-1">{n.message}</p>
                      <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-300">
                        <span>{format(new Date(n.createdAt), 'PPpp')}</span>
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Dark Mode */}
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            onClick={toggleDarkMode}
          >
            {settings.darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Settings */}
          <Link to="/settings" className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200">
            <Settings className="h-5 w-5" />
          </Link>

          {/* Auth */}
          {isLoggedIn ? (
            <Link to="/profile" className="ml-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <UserIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            </Link>
          ) : (
            <>
              <Link to="/login" className="ml-2 px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm">
                Login
              </Link>
              <Link to="/signup" className="ml-2 px-3 py-1 rounded-md border border-emerald-600 text-emerald-600 hover:bg-emerald-100 text-sm">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
