import { useEffect, useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppContext } from '../context/AppContext'
import { Home, Plus, Activity, BarChart2, Settings, X, Zap, Circle } from 'lucide-react'
import api from '../utils/api'

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

type UsageResponse = { totalKwh: number }

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation()
  const { totalDailyUsage } = useAppContext()
  const [todayKwh, setTodayKwh] = useState<number | null>(null)
  const [yesterdayKwh, setYesterdayKwh] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Handle Escape key to close sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get<UsageResponse>('/energy-usage/daily-usage', { params: { day: 'today' } }),
      api.get<UsageResponse>('/energy-usage/daily-usage', { params: { day: 'yesterday' } }),
    ])
      .then(([t, y]) => {
        setTodayKwh(t.data.totalKwh)
        setYesterdayKwh(y.data.totalKwh)
      })
      .catch(() => {
        setTodayKwh(null)
        setYesterdayKwh(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const displayKwh = todayKwh != null && todayKwh > 0 ? todayKwh : totalDailyUsage

  const percentageChange = useMemo(() => {
    if (todayKwh == null || yesterdayKwh == null || yesterdayKwh <= 0) return null
    const delta = displayKwh - yesterdayKwh
    return Math.round((delta / yesterdayKwh) * 100)
  }, [displayKwh, todayKwh, yesterdayKwh])

  const cardColor = percentageChange == null
    ? 'bg-gray-100 dark:bg-gray-700'
    : percentageChange > 0
    ? 'bg-red-100 dark:bg-red-800'
    : percentageChange < 0
    ? 'bg-emerald-50 dark:bg-emerald-800'
    : 'bg-gray-100 dark:bg-gray-700'

  const trendText = loading
    ? 'Loading…'
    : percentageChange == null
    ? 'Estimated usage'
    : percentageChange > 0
    ? `${percentageChange}% higher than yesterday`
    : percentageChange < 0
    ? `${Math.abs(percentageChange)}% lower than yesterday`
    : 'Same usage as yesterday'

  const navigation = useMemo(
    () => [
      { name: 'Dashboard', icon: Home, href: '/' },
      { name: 'Add Appliance', icon: Plus, href: '/add-appliance' },
      { name: 'Insights', icon: Activity, href: '/insights' },
      { name: 'Compare', icon: BarChart2, href: '/compare' },
      { name: 'Settings', icon: Settings, href: '/settings' },
    ],
    []
  )

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-bg shadow-lg transform transition-transform duration-300 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } border-r border-gray-200 dark:border-dark-border`}
        aria-label="Sidebar"
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-border">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                EnergyIQ
              </span>
            </Link>
            <button
              className="md:hidden text-gray-500 dark:text-gray-400"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex-1 px-4 space-y-1">
            {navigation.map(item => {
              const active = location.pathname === item.href
              const Icon = item.icon || Circle
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center px-2 py-3 rounded-lg text-sm font-medium ${
                    active
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/10 dark:text-emerald-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-dark-input'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 ${
                      active ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer: Current Usage Card */}
          <div className="p-4 mt-auto border-t border-gray-200 dark:border-dark-border">
            <div className={`${cardColor} p-3 rounded-lg`}>
              <h4 className="text-sm font-medium text-gray-800 dark:text-white">Current Usage</h4>
              <div className="mt-1 flex items-center">
                {loading ? (
                  <div className="w-24 h-6 bg-gray-200 dark:bg-gray-600 animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {displayKwh.toFixed(2)} kWh{' '}
                    {!loading && todayKwh == null && '(est.)'}
                  </div>
                )}
                <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Today
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{trendText}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
