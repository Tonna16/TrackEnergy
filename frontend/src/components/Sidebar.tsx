// src/components/Sidebar.tsx
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
  History,
} from 'lucide-react';
import api from '../utils/api';
import { getAuthToken } from '../utils/auth';
import { observedDailyTotals } from '../utils/historyForecast';

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

type UsageResponse = {
  date: string;
  totalKwh: number;
  hasRecordedUsage: boolean;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Sidebar({ open, setOpen }: SidebarProps) {
  const location = useLocation();
  const { totalDailyUsage, backendEnabled, demoMode, historyEntries } = useAppContext();

  const [todayReading, setTodayReading] = useState<UsageResponse | null>(null);
  const [yesterdayReading, setYesterdayReading] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoggedIn = backendEnabled && Boolean(getAuthToken());

  // Fetch today/yesterday only when logged in
  useEffect(() => {
    if (!isLoggedIn) {
      setTodayReading(null);
      setYesterdayReading(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get<UsageResponse>('energy-usage/daily-usage', { params: { day: 'today' } }),
      api.get<UsageResponse>('energy-usage/daily-usage', { params: { day: 'yesterday' } }),
    ])
      .then(([todayRes, yesterdayRes]) => {
        setTodayReading(todayRes.data);
        setYesterdayReading(yesterdayRes.data);
      })
      .catch(() => {
        setTodayReading(null);
        setYesterdayReading(null);
      })
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  const localReadings = useMemo(() => {
    if (!demoMode) return { today: null, yesterday: null };
    const totals = observedDailyTotals(historyEntries);
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const readingFor = (date: Date): UsageResponse | null => {
      const iso = toIsoDate(date);
      const total = totals.find(entry => entry.date === iso);
      return total ? { date: iso, totalKwh: total.kwh, hasRecordedUsage: true } : null;
    };
    return { today: readingFor(today), yesterday: readingFor(yesterday) };
  }, [demoMode, historyEntries]);

  const todayUsage = demoMode ? localReadings.today : todayReading;
  const yesterdayUsage = demoMode ? localReadings.yesterday : yesterdayReading;
  const hasRecordedToday = todayUsage?.hasRecordedUsage === true;
  const hasRecordedYesterday = yesterdayUsage?.hasRecordedUsage === true;
  const displayKwh = todayUsage?.hasRecordedUsage === true ? todayUsage.totalKwh : totalDailyUsage;
  const yesterdayKwh = yesterdayUsage?.hasRecordedUsage === true ? yesterdayUsage.totalKwh : null;

  const percentageChange = useMemo(() => {
    if (
      !hasRecordedToday ||
      yesterdayKwh == null ||
      yesterdayKwh <= 0
    )
      return null;
    const delta = displayKwh - yesterdayKwh;
    return Math.round((delta / yesterdayKwh) * 100);
  }, [displayKwh, hasRecordedToday, yesterdayKwh]);

  const cardColor = percentageChange == null
    ? 'bg-gray-100 dark:bg-gray-700'
    : percentageChange > 0
      ? 'bg-red-100 dark:bg-red-800'
      : 'bg-emerald-50 dark:bg-emerald-800';

  let trendText: string;
  if (loading) trendText = 'Loading…';
  else if (!hasRecordedToday) trendText = 'Formula estimate from included appliances';
  else if (!hasRecordedYesterday) trendText = 'Recorded today · may be incomplete';
  else if (percentageChange! > 0) trendText = `${percentageChange}% higher than yesterday · today may be incomplete`;
  else if (percentageChange! < 0) trendText = `${Math.abs(percentageChange!)}% lower than yesterday · today may be incomplete`;
  else trendText = 'Same as yesterday · today may be incomplete';

  const navigation = useMemo(() => {
    const base = [
      { name: 'Dashboard', icon: Home, href: '/' },
      { name: 'Add Appliance', icon: Plus, href: '/add-appliance' },
      ...(backendEnabled ? [] : [{ name: 'Usage History', icon: History, href: '/history' }]),
      { name: 'Compare', icon: BarChart2, href: '/compare' },
      { name: 'Insights', icon: Activity, href: '/insights' },
      { name: 'Settings', icon: Settings, href: '/settings' },
    ];
    if (backendEnabled && !isLoggedIn) {
      base.push({ name: 'Login', icon: LogIn, href: '/login' });
    }
    return base;
  }, [backendEnabled, isLoggedIn]);

  const closeOnMobileOnly = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="app-chrome fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          app-chrome fixed inset-y-0 left-0 z-50 w-64 bg-white/95 dark:bg-dark-bg/95 backdrop-blur-md
          shadow-xl transform transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
          border-r border-gray-200 dark:border-dark-border
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo + Close */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-border">
            <Link to="/" className="flex items-center space-x-2">
              <Zap className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                EnergyIQ
              </span>
            </Link>
            <button
              className="text-gray-500 dark:text-gray-400"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
              title="Close"
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
                  onClick={closeOnMobileOnly}
                  className={`
                    flex items-center px-2 py-3 text-sm font-medium rounded-lg transition-all duration-200
                    ${active
                      ? 'bg-emerald-50 text-emerald-600 shadow-sm dark:bg-emerald-900/10 dark:text-emerald-400'
                      : 'text-gray-700 hover:bg-gray-100 hover:translate-x-0.5 dark:text-white dark:hover:bg-dark-input'
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

          {/* Daily usage or estimate */}
          <div className="p-4 mt-auto border-t border-gray-200 dark:border-dark-border">
            <div className={`${cardColor} p-3 rounded-lg transition-all duration-300 ${!loading ? 'pulse-soft' : ''}`}>
              <h4 className="text-sm font-medium text-gray-800 dark:text-white">
                {hasRecordedToday ? 'Recorded Daily Usage' : 'Estimated Daily Usage'}
              </h4>
              <div className="mt-1 flex items-center">
                {loading ? (
                  <div className="w-24 h-6 bg-gray-200 dark:bg-gray-600 animate-pulse rounded" />
                ) : (
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {displayKwh.toFixed(2)} kWh
                  </div>
                )}
                <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  / day
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
