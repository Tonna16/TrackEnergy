// src/context/AppContext.tsx
import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react'
import { applianceDatabase } from '../data/applianceDatabase'

// --- Types -----------------------------------------------------------------

export type Appliance = {
  id: string
  name: string
  wattage: number
  hoursPerDay: number
  daysPerWeek: number
  brand?: string
  model?: string
  type: string
  location: string
  isHighEfficiency: boolean
  estimatedDailyKWh?: number
}

export type ApplianceInput = Omit<Appliance, 'id'>

export type DailyUsagePoint = {
  date: string
  total: number   // cost in display currency
  byAppliance: Record<string, number> // cost in display currency
}

export type UserSettings = {
  currency: 'USD' | 'EUR'
  householdSize: number
  darkMode: boolean
  electricityRate: number   // Always stored in USD/kWh
  name: string
}

type UsageLog = {
  date: string
  total: number
  byAppliance: Record<string, number>
}

type AppMode = 'simulated' | 'live'

export type NotificationLevel = 'info' | 'warning' | 'alert' | 'success'

export type AppNotification = {
  id: number
  type: NotificationLevel
  title: string
  message: string
  createdAt: string
  read: boolean
}

export type AppContextType = {
  // Appliances & usage
  appliances: Appliance[]
  addAppliance(input: ApplianceInput): void
  updateAppliance(updated: Appliance): void
  deleteAppliance(id: string): void
  getAppliance(id: string): Appliance | undefined

  totalDailyUsage: number
  totalDailyCost: number
  yearlyCarbonFootprint: number
  estimatedAnnualSavings: number
  highestConsumers: Appliance[]
  topConsumers: { appliance: Appliance; usage: number }[]
  dailyUsageSeries: DailyUsagePoint[]

  // Settings & currency
  settings: UserSettings
  updateSettings(updates: Partial<UserSettings>): void
  appMode: AppMode
  setAppMode(mode: AppMode): void

  currentRate: number   // USD→display currency rate
  symbol: '$' | '€'     // display symbol
  convertCost(rawUsd: number): number   // converts USD to display currency
  formatCost(rawUsd: number): string    // formats cost with symbol

  // Manual usage
  logManualUsage(log: UsageLog): void

  // Notifications
  notifications: AppNotification[]
  addNotification(opts: {
    type: NotificationLevel
    title: string
    message: string
  }): void
  markNotificationRead(id: number): void

  // Metadata
  getApplianceTypeInfo(type: string): { averageWattage: number } | undefined
}

// --- Context Setup ---------------------------------------------------------

const AppContext = createContext<AppContextType | undefined>(undefined)

const EMISSION_FACTOR_KG_PER_KWH = 0.417
const SAVINGS_PERCENTAGE = 0.15

const defaultSettings: UserSettings = {
  currency: 'USD',
  householdSize: 2,
  darkMode: false,
  electricityRate: 0.15,
  name: 'User',
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Core state
  const [appliances, setAppliances] = useState<Appliance[]>(() => {
    const saved = localStorage.getItem('appliances')
    return saved ? JSON.parse(saved) : []
  })
  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('settings')
    return saved ? JSON.parse(saved) : defaultSettings
  })
  const [appMode, setAppMode] = useState<AppMode>(() =>
    localStorage.getItem('appMode') === 'live' ? 'live' : 'simulated'
  )
  const [manualUsageLog, setManualUsageLog] = useState<UsageLog[]>(() => {
    const saved = localStorage.getItem('manualUsageLog')
    return saved ? JSON.parse(saved) : []
  })

  // FX rate & symbol
  const [fxRate, setFxRate] = useState<number>(1)
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
    document.documentElement.classList.toggle('dark', settings.darkMode)
  }, [settings])

  useEffect(() => {
    if (settings.currency === 'USD') {
      setFxRate(1);
      return;
    }
    // Default to 0.87 first before fetching
    setFxRate(0.87);
  
    fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR')
      .then((res) => res.json())
      .then((json) => {
        if (json.rates?.EUR) {
          setFxRate(json.rates.EUR);
        }
      })
      .catch(() => {
        // fallback to 0.87 if fetch fails
        setFxRate(0.87);
      });
  }, [settings.currency]);
  

  const currentRate = useMemo(
    () =>
      settings.currency === 'EUR'
        ? settings.electricityRate * fxRate
        : settings.electricityRate,
    [settings.electricityRate, settings.currency, fxRate]
  )
  const symbol = useMemo(
    () => (settings.currency === 'EUR' ? '€' : '$'),
    [settings.currency]
  )

  // cost conversion helpers
  const convertCost = useCallback(
    (rawUsd: number) => rawUsd * currentRate,
    [currentRate]
  )
  const formatCost = useCallback(
    (rawUsd: number) => `${symbol}${(rawUsd * currentRate).toFixed(2)}`,
    [currentRate, symbol]
  )

  // In-app notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const addNotification = ({
    type,
    title,
    message,
  }: {
    type: NotificationLevel
    title: string
    message: string
  }) => {
    setNotifications((prev) => [
      {
        id: Date.now(),
        type,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ])
  }
  const markNotificationRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  // Fire notification on currency changes
  useEffect(() => {
    if (settings.currency === 'EUR' && fxRate !== 1) {
      addNotification({
        type: 'info',
        title: 'Currency Changed',
        message: `New rate: €{formatCost(1)}/kWh`,
      })
    } else if (settings.currency === 'USD') {
      addNotification({
        type: 'info',
        title: 'Currency Reset',
        message: `New rate: ${formatCost(1)}/kWh`,
      })
    }
  }, [settings.currency, currentRate, fxRate, formatCost])

  // Persistence
  useEffect(() => {
    localStorage.setItem('appliances', JSON.stringify(appliances))
  }, [appliances])
  useEffect(() => {
    localStorage.setItem('appMode', appMode)
  }, [appMode])
  useEffect(() => {
    localStorage.setItem('manualUsageLog', JSON.stringify(manualUsageLog))
  }, [manualUsageLog])

  // Handlers
  const updateSettings = (updates: Partial<UserSettings>) =>
    setSettings((prev) => ({ ...prev, ...updates }))

  const addAppliance = (input: ApplianceInput) => {
    setAppliances((prev) => [
      ...prev,
      {
        ...input,
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
      },
    ])
  }
  const updateAppliance = (updated: Appliance) =>
    setAppliances((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    )
  const deleteAppliance = (id: string) =>
    setAppliances((prev) => prev.filter((a) => a.id !== id))
  const getAppliance = (id: string) => appliances.find((a) => a.id === id)
  const logManualUsage = (log: UsageLog) =>
    setManualUsageLog((prev) => {
      const rest = prev.filter((e) => e.date !== log.date)
      return [...rest, log].sort((a, b) => a.date.localeCompare(b.date))
    })

  // Derived metrics
  const totalDailyUsage = useMemo(
    () =>
      appliances.reduce(
        (sum, a) =>
          sum + (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000,
        0
      ),
    [appliances]
  )
  const totalDailyCost = useMemo(
    () => totalDailyUsage * currentRate,
    [totalDailyUsage, currentRate]
  )
  const yearlyCarbonFootprint = useMemo(
    () => totalDailyUsage * 365 * EMISSION_FACTOR_KG_PER_KWH,
    [totalDailyUsage]
  )
  const estimatedAnnualSavings = useMemo(
    () => totalDailyCost * 365 * SAVINGS_PERCENTAGE,
    [totalDailyCost]
  )
  const highestConsumers = useMemo(() => {
    return [...appliances]
      .sort((a, b) => {
        const ua = (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000
        const ub = (b.wattage * b.hoursPerDay * (b.daysPerWeek / 7)) / 1000
        return ub - ua
      })
      .slice(0, 3)
  }, [appliances])
  const topConsumers = useMemo(() => {
    return [...appliances]
      .map((a) => ({
        appliance: a,
        usage: (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000,
      }))
      .sort((x, y) => y.usage - x.usage)
      .slice(0, 5)
  }, [appliances])
  const dailyUsageSeries = useMemo<DailyUsagePoint[]>(() => {
    const days = 30
    const today = new Date().toISOString().split('T')[0]
    const past = manualUsageLog.filter((l) => l.date >= today)
    const series: DailyUsagePoint[] = []
    for (let i = 1; i <= days; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const key = d.toISOString().split('T')[0]
      const found = appMode === 'live' && past.find((l) => l.date === key)
      if (found) {
        series.push({ date: key, total: found.total, byAppliance: found.byAppliance })
      } else {
        let totalCost = 0
        const byApp: Record<string, number> = {}
        appliances.forEach((app) => {
          const baseKwh = (app.wattage * app.hoursPerDay) / 1000
          const noise = 1 + (Math.random() * 0.2 - 0.1)
          const cost = baseKwh * noise * currentRate
          byApp[app.name] = cost
          totalCost += cost
        })
        series.push({ date: key, total: totalCost, byAppliance: byApp })
      }
    }
    return series
  }, [appliances, appMode, manualUsageLog, currentRate])

  const getApplianceTypeInfo = (type: string) =>
    applianceDatabase[type]
      ? { averageWattage: applianceDatabase[type].defaultWattage }
      : undefined

  return (
    <AppContext.Provider
      value={{
        appliances,
        addAppliance,
        updateAppliance,
        deleteAppliance,
        getAppliance,
        totalDailyUsage,
        totalDailyCost,
        yearlyCarbonFootprint,
        estimatedAnnualSavings,
        highestConsumers,
        topConsumers,
        dailyUsageSeries,
        settings,
        updateSettings,
        appMode,
        setAppMode,
        currentRate,
        symbol,
        convertCost,
        formatCost,
        logManualUsage,
        notifications,
        addNotification,
        markNotificationRead,
        getApplianceTypeInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
