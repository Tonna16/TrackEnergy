// src/components/Header.tsx
import { useState, useEffect } from 'react'
import {
  Menu,
  Moon,
  Sun,
  Settings,
  User as UserIcon,
} from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthToken } from '../utils/auth'
import NotificationsPanel from './NotificationsPanel'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export default function Header({ setSidebarOpen }: HeaderProps) {
  const { settings, updateSettings } = useAppContext()
  const navigate = useNavigate()

  // determine login state
  const authToken = getAuthToken()
  const isLoggedIn = Boolean(authToken)

  // update UI on logout/login in other tabs
  useEffect(() => {
    const handleStorage = () => {
      const freshToken = getAuthToken()
      if (!freshToken) {
        // if token cleared elsewhere, send user to dashboard
        navigate('/', { replace: true })
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [navigate])

  // dark mode toggle
  const toggleDarkMode = () => {
    updateSettings({ darkMode: !settings.darkMode })
  }

  return (
    <header className="bg-offwhite-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
        {/* Sidebar & Brand */}
        <div className="flex items-center">
          <button
            type="button"
            className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/" className="hidden md:flex items-center text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            EnergyIQ
          </Link>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4 relative">
          {/* Notifications */}
          {isLoggedIn && <NotificationsPanel />}

          {/* Dark Mode */}
          <button
            type="button"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
          >
            {settings.darkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </button>

          {/* Settings */}
          <Link
            to="/settings"
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Auth */}
          {isLoggedIn ? (
            <Link
              to="/profile"
              className="ml-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Profile"
            >
              <UserIcon className="h-6 w-6 text-gray-600 dark:text-gray-300" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="ml-2 px-3 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="ml-2 px-3 py-1 rounded-md border border-emerald-600 text-emerald-600 hover:bg-emerald-100 text-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
