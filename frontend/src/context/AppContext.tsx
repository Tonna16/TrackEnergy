// src/context/AppContext.tsx
import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
  useRef,
} from 'react'
import type { AxiosError } from 'axios'
import { applianceDatabase } from '../data/applianceDatabase'
import { getAuthToken, logout, refreshAccessTokenIfNeeded } from '../utils/auth'
import { generateEstimate } from '../utils/energyEstimator'
import {
  isVisibleAppliance,
  withVisibilityDefaults,
} from '../utils/applianceVisibility'
import api from '../utils/api'

const EMISSION_FACTOR_KG_PER_KWH = 0.417
const SAVINGS_PERCENTAGE = 0.15
const DEFAULT_USD_TO_EUR = 0.86
const MAX_WATTAGE = 10000 // max wattage for household appliances
const MAX_KWH_PER_DAY = 30 // max kWh per day for a single appliance

function sanitizeSettings(partial: Partial<UserSettings> | undefined): UserSettings {
  const base: UserSettings = {
    currency: 'USD',
    householdSize: 2,
    darkMode: false,
    electricityRate: 0.17,
    exchangeRate: DEFAULT_USD_TO_EUR,
  };
  if (!partial) return base;
  return {
    currency: partial.currency === 'EUR' ? 'EUR' : 'USD',
    householdSize: typeof partial.householdSize === 'number' ? partial.householdSize : base.householdSize,
    darkMode: typeof partial.darkMode === 'boolean' ? partial.darkMode : base.darkMode,
    electricityRate: typeof partial.electricityRate === 'number' ? partial.electricityRate : base.electricityRate,
    exchangeRate: typeof partial.exchangeRate === 'number' ? partial.exchangeRate : base.exchangeRate,
  };
}

export type Appliance = {
  id: number
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
  active?: boolean
  deleted?: boolean
}

type ApplianceInput = Omit<Appliance, 'id'>

type UserSettings = {
  currency: 'USD' | 'EUR'
  householdSize: number
  darkMode: boolean
  electricityRate: number         // frontend field (maps to backend electricityRatePerKWh)
  exchangeRate: number
}

type UsageLog = {
  date: string
  total: number
  byAppliance: Record<string, number>
}

type AppMode = 'simulated' | 'live'

type AppContextType = {
  appliances: Appliance[]
  addAppliance(input: ApplianceInput): Promise<Appliance | undefined>
  updateAppliance(updated: Appliance): Promise<void>
  deleteAppliance(id: number): Promise<void>
  getAppliance(id: number): Appliance | undefined
  forecastedDailyCost: number

  totalDailyUsage: number
  totalDailyCost: number
  yearlyCarbonFootprint: number
  estimatedAnnualSavings: number

  settings: UserSettings
  updateSettings(updates: Partial<UserSettings>): Promise<void>
  appMode: AppMode
  setAppMode(mode: AppMode): void

  costFromKwh(kwh: number): number
  convertCurrency(usd: number): number
  formatCost(usd: number): string
  formatConvertedCost(val: number): string
  symbol: '$' | '€'
  currentRate: number

  logManualUsage(log: UsageLog): void
  getApplianceTypeInfo(type: string): { averageWattage: number } | undefined
  fetchLiveRate(toCurrency: 'USD' | 'EUR'): Promise<number>

  dailyUsageSeries: UsageLog[]
  authReady: boolean
  authStatus: 'checking' | 'authenticated' | 'unauthenticated'
  authError: { kind: 'transient'; message: string } | null
  resolveAuthState(): Promise<void>
  syncAuthModeWithToken(): Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Validate an appliance object and ensure it's not deleted/inactive
const isValidAppliance = (a: Appliance): boolean => {
  if (!a || typeof a !== 'object') return false
  if (!isVisibleAppliance(a, false)) return false
  if (!a.name || typeof a.name !== 'string') return false
  if (isNaN(a.wattage) || a.wattage <= 0 || a.wattage > MAX_WATTAGE) return false
  if (isNaN(a.hoursPerDay) || a.hoursPerDay < 0 || a.hoursPerDay > 24) return false
  if (isNaN(a.daysPerWeek) || a.daysPerWeek < 0 || a.daysPerWeek > 7) return false
  const dailyKwh = (a.wattage * a.hoursPerDay) / 1000
  if (dailyKwh > MAX_KWH_PER_DAY) return false
  return true
}

const isValidLog = (log: UsageLog): boolean => {
  return (
    typeof log.date === 'string' &&
    !isNaN(Date.parse(log.date)) &&
    typeof log.total === 'number' &&
    log.total >= 0 &&
    typeof log.byAppliance === 'object' &&
    Object.values(log.byAppliance).every(val => typeof val === 'number' && val >= 0)
  )
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [forecastedDailyCostLive, setForecastedDailyCostLive] = useState<number | null>(null)

  const [appliances, setAppliances] = useState<Appliance[]>(() => {
    try {
      const saved = localStorage.getItem('appliances')
      return saved ? JSON.parse(saved).filter(isValidAppliance) : []
    } catch {
      return []
    }
  })
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('settings');
      return sanitizeSettings(saved ? JSON.parse(saved) : undefined);
    } catch {
      return sanitizeSettings(undefined);
    }
  });

  // auth readiness: prevents early API calls before token refresh attempt
  const [authReady, setAuthReady] = useState(false)
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking')
  const [authError, setAuthError] = useState<{ kind: 'transient'; message: string } | null>(null)

  const [appMode, setAppMode] = useState<AppMode>(() => {
    const savedMode = localStorage.getItem('appMode')
    return savedMode === 'live' ? 'live' : 'simulated'
  })

  const [manualUsageLog, setManualUsageLog] = useState<UsageLog[]>(() => {
    try {
      const saved = localStorage.getItem('manualUsageLog')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('appliances', JSON.stringify(appliances))
  }, [appliances])

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('appMode', appMode)
  }, [appMode])

  // --- NEW: Attempt to refresh access token on app start, then mark authReady ---
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Attempt to refresh token if needed. If it fails that's fine: we set authReady anyway.
        await refreshAccessTokenIfNeeded()
      } catch (err) {
        // swallow - we still mark authReady so the app can continue as guest
        if (import.meta.env.MODE === 'development') {
          console.debug('[AppContext] refreshAccessTokenIfNeeded failed:', err)
        }
      } finally {
        if (mounted) setAuthReady(true)
      }
    })()
    return () => { mounted = false }
  }, [])

  // If authReady becomes true, set appMode depending on presence of token
  useEffect(() => {
    if (!authReady) return
    setAppMode(getAuthToken() ? 'live' : 'simulated')
  }, [authReady])

  const resolveAuthState = useCallback(async () => {
    if (!authReady) {
      setAuthStatus('checking')
      return
    }

    const token = getAuthToken()
    if (!token) {
      setAuthStatus('unauthenticated')
      setAuthError(null)
      return
    }

    try {
      await api.get('profile')
      setAuthStatus('authenticated')
      setAuthError(null)
    } catch (err) {
      const status = (err as AxiosError | undefined)?.response?.status
      if (status === 401 || status === 403) {
        setAuthStatus('unauthenticated')
        setAuthError(null)
        logout()
        return
      }

      // Keep stale session for transient failures and allow retry.
      setAuthStatus('authenticated')
      setAuthError({
        kind: 'transient',
        message: 'Could not verify your session. Check your connection and retry.',
      })
    }
  }, [authReady])

  const syncAuthModeWithToken = useCallback(async () => {
    const hasToken = Boolean(getAuthToken())
    setAppMode(hasToken ? 'live' : 'simulated')
    await resolveAuthState()
  }, [resolveAuthState])

  useEffect(() => {
    void resolveAuthState()
  }, [resolveAuthState])

  // If logged in and authReady, fetch persisted settings from SettingsController
  useEffect(() => {
    if (!authReady) return

    const token = getAuthToken()
    if (!token) return

    (async () => {
      try {
        const res = await api.get<any>('settings')
        const serverShape = {
          currency: res.data?.currency, // optional if you extend server
          householdSize: res.data?.householdSize,
          darkMode: res.data?.darkMode,
          electricityRate: res.data?.electricityRatePerKWh ?? res.data?.electricityRate,
          exchangeRate: res.data?.exchangeRate ?? DEFAULT_USD_TO_EUR,
        };
        setSettings(prev => ({ ...prev, ...sanitizeSettings(serverShape) }));
      } catch (err) {
        console.error('Failed to load user settings', err)
      }
    })()
  }, [authReady])

  // Fetch forecasted daily cost from backend (robust to response shape)
  useEffect(() => {
    let cancelled = false;

    const fetchForecastedDailyCost = async () => {
      // require authReady to avoid racing before token refresh attempt
      if (!authReady) {
        if (!cancelled) setForecastedDailyCostLive(null)
        return
      }

      const token = getAuthToken();
      const isLoggedIn = Boolean(token);

      // Early return for guests / simulated mode
      if (appMode !== 'live' || !isLoggedIn) {
        if (!cancelled) setForecastedDailyCostLive(null);
        return;
      }

      try {
        const response = await api.get('energy-usage/forecasted-daily-cost');
        const val =
          typeof response.data === 'number'
            ? response.data
            : response.data?.forecastedDailyCost ?? null;

        if (!cancelled) {
          if (typeof val === 'number') setForecastedDailyCostLive(val);
          else setForecastedDailyCostLive(null);
        }
      } catch (error) {
        if (!cancelled) setForecastedDailyCostLive(null);
      }
    };

    fetchForecastedDailyCost();

    return () => { cancelled = true; };
  }, [authReady, appMode, appliances]);

  useEffect(() => {
    localStorage.setItem('manualUsageLog', JSON.stringify(manualUsageLog))
  }, [manualUsageLog])

  // Fetch appliances from backend when in live mode (wait for authReady)
  useEffect(() => {
    const fetchAppliances = async () => {
      if (!authReady) return // wait until auth refresh attempt finishes

      if (appMode === 'live') {
        try {
          const res = await api.get<Appliance[]>('appliances')
          const visible = res.data
            .map(a => withVisibilityDefaults(a))
            .filter(a => a && isVisibleAppliance(a, false))
            .filter(isValidAppliance)
          setAppliances(visible)
        } catch (err) {
          console.error('Failed to fetch appliances:', err)
        }
      } else {
        // Load from localStorage for simulated mode (existing behavior)
        const saved = localStorage.getItem('appliances')
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            setAppliances(parsed.filter(isValidAppliance))
          } catch {
            setAppliances([])
          }
        } else {
          setAppliances([])
        }
      }
    }
    fetchAppliances()
  }, [authReady, appMode])

  const [fxRate, setFxRate] = useState<number>(settings.exchangeRate)
  useEffect(() => {
    setFxRate(settings.currency === 'EUR' ? settings.exchangeRate : 1)
  }, [settings.currency, settings.exchangeRate])

  const usdRate = settings.electricityRate
  const currencyRate = settings.currency === 'EUR' ? fxRate : 1
  const currentRate = usdRate * currencyRate

  const costFromKwh = useCallback((kwh: number) => kwh * currentRate, [currentRate])
  const convertCurrency = useCallback((usd: number) => usd * currencyRate, [currencyRate])
  const symbol = useMemo(() => (settings.currency === 'EUR' ? '€' : '$'), [settings.currency])

  const currencyCode = settings.currency && (settings.currency === 'USD' || settings.currency === 'EUR')
    ? settings.currency
    : 'USD'

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currencyCode]
  )

  const formatCost = useCallback(
    (usd: number) => currencyFormatter.format(usd * currencyRate),
    [currencyFormatter, currencyRate]
  )

  const formatConvertedCost = useCallback(
    (val: number) => currencyFormatter.format(val),
    [currencyFormatter]
  )

  const fetchLiveRate = useCallback(async (toCurrency: 'USD' | 'EUR') => {
    if (toCurrency === 'USD') return 1
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR')
      const json = await res.json()
      return json.rates.EUR ?? DEFAULT_USD_TO_EUR
    } catch {
      return DEFAULT_USD_TO_EUR
    }
  }, [])

  const totalDailyUsage = useMemo(
    () =>
      appliances
        .filter(a => isVisibleAppliance(a, false))
        .reduce(
        (sum, app) => sum + (app.wattage * app.hoursPerDay * app.daysPerWeek) / 7 / 1000,
        0
      ),
    [appliances]
  )

  const seasonalAdjust = true

  // Use backend live forecast if available, otherwise client estimate
  const forecastedDailyCost = useMemo(() => {
    if (appMode === 'live' && forecastedDailyCostLive !== null) {
      return forecastedDailyCostLive
    }

    const visibleAppliances = appliances.filter(a => isVisibleAppliance(a, false))

    const points = generateEstimate({
      appliances: visibleAppliances,
      convertCost: costFromKwh,
      count: 30,
      daysPer: 1,
      mode: appMode,
      seasonalAdjust,
      disableNoise: false,
      includeInactive: false,
    })

    const total = points.reduce((sum, p) => sum + (p.total ?? 0), 0)
    return total / 30
  }, [appliances, costFromKwh, appMode, forecastedDailyCostLive])

  const totalDailyCost = useMemo(() => costFromKwh(totalDailyUsage), [totalDailyUsage, costFromKwh])

  const yearlyCarbonFootprint = useMemo(
    () => totalDailyUsage * 365 * EMISSION_FACTOR_KG_PER_KWH,
    [totalDailyUsage]
  )

  const estimatedAnnualSavings = useMemo(
    () => totalDailyCost * 365 * SAVINGS_PERCENTAGE,
    [totalDailyCost]
  )

  const dailyUsageSeries = useMemo(
    () => [...manualUsageLog].sort((a, b) => a.date.localeCompare(b.date)),
    [manualUsageLog]
  )

  const addAppliance = async (input: ApplianceInput): Promise<Appliance | undefined> => {
    const normalizedInput = withVisibilityDefaults(input)
    if (!isValidAppliance({ ...normalizedInput, id: 0 } as Appliance)) {
      console.warn('Rejected appliance due to invalid input', input)
      return undefined
    }

    if (appMode === 'live') {
      try {
        const res = await api.post<Appliance>('appliances', normalizedInput) // backend assigns ID
        const normalizedResponse = withVisibilityDefaults(res.data)
        if (normalizedResponse && isVisibleAppliance(normalizedResponse, false) && isValidAppliance(normalizedResponse)) {
          setAppliances(prev => [normalizedResponse, ...prev])
        }
        return normalizedResponse
      } catch (err) {
        console.error('Failed to add appliance:', err)
        return undefined
      }
    } else {
      const newApp: Appliance = {
        ...normalizedInput,
        id: Math.floor(Math.random() * 1_000_000_000),
      }
      setAppliances(prev => [newApp, ...prev])
      return newApp
    }
  }

  const updateAppliance = async (updated: Appliance) => {
    const normalizedUpdated = withVisibilityDefaults(updated)
    if (!isValidAppliance(normalizedUpdated)) {
      console.warn('Rejected appliance due to invalid input', updated)
      return
    }

    if (appMode === 'live') {
      try {
        await api.put(`appliances/${normalizedUpdated.id}`, normalizedUpdated)
        setAppliances(prev => prev.map(a => (a.id === normalizedUpdated.id ? normalizedUpdated : a)))
      } catch (err) {
        console.error('Failed to update appliance:', err)
      }
    } else {
      setAppliances(prev => prev.map(a => (a.id === normalizedUpdated.id ? normalizedUpdated : a)))
    }
  }

  const deleteAppliance = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this appliance?")) return
    if (appMode === 'live') {
      try {
        await api.delete(`appliances/${id}`)
        setAppliances(prev => prev.filter(a => a.id !== id))
      } catch (err) {
        console.error('Failed to delete appliance', err)
        alert('Failed to delete appliance. Please try again.')
      }
    } else {
      setAppliances(prev => prev.filter(a => a.id !== id))
    }
  }

  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])
  
  // updateSettings: update local state immediately, persist when user is logged in
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
  
    if (!getAuthToken()) {
      // guest: nothing to persist server-side
      return
    }
  
    try {
      // merge with latest
      const mergedFrontend = { ...settingsRef.current, ...updates }
  
      // server expects electricityRatePerKWh and householdSize
      const serverPayload: any = {
        electricityRatePerKWh: mergedFrontend.electricityRate,
        householdSize: mergedFrontend.householdSize
        // optionally include other server-side fields (location) if needed
      }
  
      const res = await api.put<any>('settings', serverPayload)
  
      // Map server response back to frontend shape; fallback to mergedFrontend
      const serverRate = res.data?.electricityRatePerKWh ?? res.data?.electricityRate ?? mergedFrontend.electricityRate
      const serverHouseholdSize = typeof res.data?.householdSize === 'number'
        ? res.data.householdSize
        : mergedFrontend.householdSize
  
      setSettings(prev => ({
        ...prev,
        electricityRate: serverRate,
        householdSize: serverHouseholdSize,
        // preserve currency/exchangeRate/darkMode that are only frontend-managed
        currency: prev.currency ?? 'USD',
        exchangeRate: prev.exchangeRate ?? DEFAULT_USD_TO_EUR,
        darkMode: prev.darkMode ?? false,
      }));
    } catch (err) {
      console.error('Failed to save settings', err)
    }
  }, [])
  

  return (
    <AppContext.Provider
      value={{
        appliances,
        addAppliance,
        updateAppliance,
        deleteAppliance,
        getAppliance: id => appliances.find(a => a.id === id),
        forecastedDailyCost,
        totalDailyUsage,
        totalDailyCost,
        yearlyCarbonFootprint,
        estimatedAnnualSavings,
        settings,
        updateSettings,
        appMode,
        setAppMode,
        costFromKwh,
        convertCurrency,
        formatCost,
        formatConvertedCost,
        symbol,
        currentRate,
        logManualUsage: log =>
          setManualUsageLog(prev =>
            [...prev.filter(e => e.date !== log.date), log].sort((a, b) => a.date.localeCompare(b.date))
          ),
        getApplianceTypeInfo: type =>
          applianceDatabase[type]
            ? { averageWattage: applianceDatabase[type].defaultWattage }
            : undefined,
        fetchLiveRate,
        dailyUsageSeries,
        authReady,
        authStatus,
        authError,
        resolveAuthState,
        syncAuthModeWithToken,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
export { isVisibleAppliance } from '../utils/applianceVisibility'


export const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
