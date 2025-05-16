// src/components/Header.tsx

import { useState } from 'react';
import { Menu, Bell, Moon, Sun, Settings } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { settings, updateSettings } = useAppContext();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const { alerts, tips, loading } = useNotifications();

  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode });
  };

  return (
    <header className="bg-white shadow-sm dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden md:flex items-center text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            WattWatch
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Bell Icon */}
          <button
            type="button"
            className="relative rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          {notificationsOpen && (
            <div className="absolute right-4 top-16 mt-2 w-80 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-10 border border-gray-200 dark:border-gray-700">
              <div className="p-4 space-y-4">
                <h3 className="font-medium">Notifications</h3>

                {/* Energy-Saving Tip with divider */}
                {!loading && tips[0] && tips[0] !== 'Unable to load tips.' && (
  <div className="text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-4">
    <p className="font-semibold mb-1">Energy Saving Tip</p>
    <p className="text-gray-600 dark:text-gray-400">{tips[0]}</p>
  </div>
)}

                {/* Other Alerts */}
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  {loading ? (
                    <p>Loading alerts...</p>
                  ) : alerts.length === 0 ? (
                    <p>No alerts.</p>
                  ) : (
                    alerts.map((alert) => (
                      <div className="py-2" key={alert.id}>
                        <p className="font-medium">Alert</p>
                        <p>{alert.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Dark Mode Toggle */}
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            onClick={toggleDarkMode}
          >
            {settings.darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Settings Button */}
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            onClick={() => navigate('/settings')}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
