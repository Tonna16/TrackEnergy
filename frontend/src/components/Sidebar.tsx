import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import {
  Home,
  Plus,
  Activity,
  BarChart2,
  Settings,
  X,
  Zap,
  Circle,
  LogIn,
} from 'lucide-react';
import api from '../utils/api';
import { getAuthToken } from '../utils/auth';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type UsageResponse = { totalKwh: number };

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  const { totalDailyUsage } = useAppContext();

  const [todayKwh, setTodayKwh] = useState<number | null>(null);
  const [yesterdayKwh, setYesterdayKwh] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = Boolean(getAuthToken());

  // Fetch today/yesterday only when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get<UsageResponse>('energy-usage/daily-usage', { params: { day: 'today' } }),
      api.get<UsageResponse>('energy-usage/daily-usage', { params: { day: 'yesterday' } }),
    ])
      .then(([todayRes, yesterdayRes]) => {
        setTodayKwh(todayRes.data.totalKwh);
        setYesterdayKwh(yesterdayRes.data.totalKwh);
      })
      .catch(() => {
        setTodayKwh(null);
        setYesterdayKwh(null);
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // Fall back to estimate when API is not available
  const usingEstimate = todayKwh == null || todayKwh <= 0;
  const displayKwh = usingEstimate ? totalDailyUsage : todayKwh!;

  // % change vs yesterday
  const percentageChange = useMemo(() => {
    if (
      todayKwh == null ||
      yesterdayKwh == null ||
      yesterdayKwh <= 0 ||
      displayKwh <= 0
    )
      return null;
    const delta = displayKwh - yesterdayKwh;
    return Math.round((delta / yesterdayKwh) * 100);
  }, [displayKwh, todayKwh, yesterdayKwh]);

  // Background color based on trend
  const cardColor = percentageChange == null
    ? 'bg-gray-100 dark:bg-gray-700'
    : percentageChange > 0
      ? 'bg-red-100 dark:bg-red-800'
      : 'bg-emerald-50 dark:bg-emerald-800';

  // Friendly status message
  let trendText: string;
  if (loading) trendText = 'Loading…';
  else if (usingEstimate) trendText = 'Estimated usage';
  else if (yesterdayKwh == null) trendText = 'No data for yesterday';
  else if (percentageChange! > 0) trendText = `${percentageChange}% higher than yesterday`;
  else if (percentageChange! < 0) trendText = `${Math.abs(percentageChange!)}% lower than yesterday`;
  else if (displayKwh <= 0) trendText = 'No usage data today';
  else trendText = 'Same usage as yesterday';

  // Sidebar nav: everyone gets Dashboard, Compare, Insights, Settings.
  // Authenticated users get Add Appliance; guests see Login.
  const navigation = useMemo(() => {
    const base = [
      { name: 'Dashboard', icon: Home,   href: '/' },
      { name: 'Compare',   icon: BarChart2, href: '/compare' },
      { name: 'Insights',  icon: Activity,  href: '/insights' },
      { name: 'Settings',  icon: Settings,  href: '/settings' },
    ];
    if (isLoggedIn) {
      base.splice(1, 0, { name: 'Add Appliance', icon: Plus, href: '/add-appliance' });
    } else {
      base.push({ name: 'Login', icon: LogIn, href: '/login' });
    }
    return base;
  }, [isLoggedIn]);

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
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-dark-bg
          shadow-lg transform transition-transform duration-300 md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          border-r border-gray-200 dark:border-dark-border
        `}
      >
        <div className="flex flex-col h-full">
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
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 mt-4 px-4 space-y-1">
            {navigation.map(item => {
              const active = location.pathname === item.href;
              const Icon = item.icon || Circle;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={`
                    flex items-center px-2 py-3 text-sm font-medium rounded-lg
                    ${active
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/10 dark:text-emerald-400'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-dark-input'
                    }
                  `}
                >
                  <Icon
                    className={`h-5 w-5 mr-3 ${
                      active ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Current Usage Card (always shown) */}
          <div className="p-4 mt-auto border-t border-gray-200 dark:border-dark-border">
            <div className={`${cardColor} p-3 rounded-lg`}>
              <h4 className="text-sm font-medium text-gray-800 dark:text-white">
                Current Usage
              </h4>
              <div className="mt-1 flex items-center">
                {loading ? (
                  <div className="w-24 h-6 bg-gray-200 dark:bg-gray-600 animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {displayKwh.toFixed(2)} kWh {usingEstimate && '(est.)'}
                  </div>
                )}
                <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Today
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {trendText}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
